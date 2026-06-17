// The easyPoints loyalty client factory (the hub).
//
// Ported from solaris-cards-storefront (app/lib/easy-points/loyalty.server.ts). Decoupled from the
// storefront's global `Env`: the factory takes an explicit `{ token, endpoint? }` config instead.
// Value-add over the source: `api.fetch` now retries on 429 honoring the `Retry-After` header.
//
// Response handling (unchanged): `keysToCamel(data)` on 2xx, return `ErrorResponse` on 4xx,
// throw `LoyaltyClientError` on 5xx.

import { CacheNone, createWithCache } from "@shopify/hydrogen";

import { keysToCamel } from "../shared/case";

import { getHeaders, getUrl } from "./client";
import { ContextError, LoyaltyClientError } from "./errors";
import { queryCustomerLoyalty } from "./loyalty-customer";

import type { LoyaltyClientConfig } from "./client";
import type {
  ApiResponse,
  CreateCouponParams,
  CreateCouponResponse,
  CustomerLoyaltyMetafield,
  ErrorResponse,
} from "../types";
import type { CustomerAccount, Storefront } from "@shopify/hydrogen";

type WithCacheOptions = Parameters<typeof createWithCache>[0];

/** Parameters for `createEasyPointsClient`, fed from the merchant's Hydrogen context. */
export interface CreateEasyPointsClientParams extends LoyaltyClientConfig {
  cache: WithCacheOptions["cache"];
  waitUntil: WithCacheOptions["waitUntil"];
  request: WithCacheOptions["request"];
}

/** The initialized Hydrogen context the loyalty client operates against. */
export interface Context {
  customerAccount: CustomerAccount;
  storefront: Storefront;
}

interface LoyaltyInitParams {
  customerAccount: CustomerAccount;
  storefront: Storefront;
}

/** Public surface of the loyalty client (the source `Loyalty` interface). */
export interface EasyPointsClient {
  init: (context: LoyaltyInitParams) => void;
  context: () => Context;
  getCustomerLoyalty: () => Promise<CustomerLoyaltyMetafield | null>;
  api: {
    fetch: <T = unknown>(endpoint: string, options: RequestInit) => ApiResponse<T>;
    createCoupon: (params: CreateCouponParams) => ApiResponse<CreateCouponResponse>;
  };
}

/** Max number of times `api.fetch` retries a 429 before giving up and returning the error. */
const MAX_RETRY_ATTEMPTS = 2;
/** Fallback delay when a 429 response has no parseable `Retry-After` header. */
const DEFAULT_RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Parses a `Retry-After` header into a delay in milliseconds. Supports both the integer-seconds
 * form (`"120"`) and the HTTP-date form (`"Wed, 21 Oct 2026 07:28:00 GMT"`).
 *
 * @param value - The raw `Retry-After` header value, or `null` when absent.
 * @returns The delay in milliseconds (never negative); {@link DEFAULT_RETRY_DELAY_MS} when the
 *   header is absent or unparseable.
 */
function parseRetryAfter(value: string | null): number {
  if (!value) return DEFAULT_RETRY_DELAY_MS;

  const seconds = Number(value);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return DEFAULT_RETRY_DELAY_MS;
}

/**
 * Creates an easyPoints loyalty client bound to a single request lifecycle.
 *
 * Typically mounted once per request as `context.loyalty` in the merchant's `context.ts`, then
 * wired to Hydrogen's `customerAccount`/`storefront` via {@link EasyPointsClient.init}. The
 * returned client owns the Bearer token and must only be used server-side.
 *
 * If `token` is empty a warning is logged (instead of throwing) so local dev without a token
 * still boots; unauthenticated requests will then surface as 4xx `ErrorResponse`s.
 *
 * @param params - Request lifecycle handles (`cache`, `waitUntil`, `request`) plus the explicit
 *   `{ token, endpoint? }` config (see {@link CreateEasyPointsClientParams}).
 * @returns An {@link EasyPointsClient} exposing `init`, `context`, `getCustomerLoyalty`, and `api`.
 *
 * @example
 * ```ts
 * // app/lib/context.ts
 * const loyalty = createEasyPointsClient({
 *   cache,
 *   waitUntil,
 *   request,
 *   token: env.EASY_POINTS_API_TOKEN,
 *   endpoint: env.EASY_POINTS_API_ENDPOINT,
 * });
 * loyalty.init({ customerAccount, storefront });
 * ```
 */
export function createEasyPointsClient({
  cache,
  waitUntil,
  request,
  token,
  endpoint,
}: CreateEasyPointsClientParams): EasyPointsClient {
  const withCache = createWithCache({ cache, waitUntil, request });

  const bearerToken = token;

  let customerAccount: CustomerAccount | undefined;
  let storefront: Storefront | undefined;

  if (!bearerToken) {
    // The merchant's context.ts owns the env var; warn rather than crash so dev without a
    // token still boots (the API will reject the empty Bearer with a 4xx ErrorResponse).
    console.warn("[easyPoints] Missing EASY_POINTS_API_TOKEN; requests will be unauthenticated.");
  }

  /**
   * Binds the Hydrogen context to the client. Must be called (typically in `context.ts`) before
   * {@link context} or {@link getCustomerLoyalty} are used.
   *
   * @param context - The request's `customerAccount` and `storefront` handles.
   */
  function init(context: LoyaltyInitParams) {
    customerAccount = context.customerAccount;
    storefront = context.storefront;
  }

  /**
   * Returns the initialized Hydrogen context.
   *
   * @returns The `{ customerAccount, storefront }` supplied to {@link init}.
   * @throws {ContextError} If {@link init} has not been called yet.
   */
  function context(): Context {
    if (!customerAccount || !storefront) {
      throw new ContextError();
    }

    return {
      customerAccount,
      storefront,
    };
  }

  /**
   * Performs an authenticated request against the loyalty API and normalizes the result.
   *
   * Sends the Bearer token + default headers, then maps the response by status:
   * - **2xx** → resolves the camelCased response body as `T`;
   * - **429** → retries honoring `Retry-After` up to {@link MAX_RETRY_ATTEMPTS}, then falls through
   *   to the 4xx path;
   * - **other 4xx** → resolves a camelCased {@link ErrorResponse} (does not throw);
   * - **5xx** → throws {@link LoyaltyClientError}.
   *
   * Caching is disabled (`CacheNone`); the request is always sent fresh.
   *
   * @typeParam T - Expected shape of a successful (2xx) response body.
   * @param endpoint_ - Path appended to the base endpoint (leading slash optional).
   * @param options - Standard `fetch` request init (method, body, headers, …).
   * @returns The camelCased success body, or an {@link ErrorResponse} for 4xx.
   * @throws {LoyaltyClientError} On 5xx responses.
   */
  async function fetch<T = unknown>(endpoint_: string, options: RequestInit): ApiResponse<T> {
    const url = getUrl({ endpoint }, endpoint_);

    for (let attempt = 0; ; attempt++) {
      const headers = getHeaders({ headers: options.headers, token: bearerToken ?? "" });

      const result = await withCache.fetch<T>(
        url,
        {
          ...options,
          headers,
        },
        // NOTE: for now we don't need caching, but in the future we can add caching if we use `GET` requests
        // 1. Only for `GET` requests
        // 2. Only if the response is not empty or an error
        // 3. Use the query params as the cache key
        {
          cacheStrategy: CacheNone(),
          shouldCacheResponse: () => false,
          cacheKey: ["loyalty", endpoint_],
        },
      );

      const { data, response } = result;

      if (response.ok) {
        return keysToCamel(data) as T;
      }

      if (response.status === 429 && attempt < MAX_RETRY_ATTEMPTS) {
        await sleep(parseRetryAfter(response.headers.get("Retry-After")));
        continue;
      }

      if (response.status >= 400 && response.status < 500) {
        // `withCache.fetch` only parses the body on 2xx; on a 4xx it leaves the response body
        // unconsumed and returns `data: null`. Parse it here so a real `ErrorResponse` surfaces.
        const errorBody = data ?? (await response.json().catch(() => null));
        return keysToCamel(errorBody) as ErrorResponse;
      }

      throw new LoyaltyClientError({ endpoint: endpoint_, response });
    }
  }

  /**
   * Redeems customer points into a discount coupon via `POST /shopify/coupons`.
   *
   * Serializes the params to the API's snake_case payload (`customer_id`, `point_value`,
   * `product_ids`) and delegates to {@link fetch}, so status handling/retries are identical.
   *
   * @param params - Customer id, point value to redeem, and eligible product ids.
   * @returns The {@link CreateCouponResponse} on success, or an {@link ErrorResponse} for 4xx.
   * @throws {LoyaltyClientError} On 5xx responses.
   */
  async function createCoupon(params: CreateCouponParams): ApiResponse<CreateCouponResponse> {
    const body = JSON.stringify({
      customer_id: params.customerId,
      point_value: params.pointValue,
      product_ids: params.productIds,
    });

    return fetch("/shopify/coupons", { method: "POST", body });
  }

  /**
   * Fetches the logged-in customer's loyalty metafield via {@link queryCustomerLoyalty}.
   *
   * @returns The normalized {@link CustomerLoyaltyMetafield}, or `null` when unavailable
   *   (e.g. not logged in, no metafield).
   * @throws {ContextError} If {@link init} has not been called yet.
   */
  async function getCustomerLoyalty() {
    return queryCustomerLoyalty(context());
  }

  return {
    init,
    context,
    getCustomerLoyalty,
    api: {
      fetch,
      createCoupon,
    },
  };
}
