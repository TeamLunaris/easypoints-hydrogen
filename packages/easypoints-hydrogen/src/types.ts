// Public type surface for `@teamlunaris/easypoints-hydrogen`.
//
// Isomorphic and secret-free: domain types ported from solaris-cards-storefront
// (app/lib/easy-points/types.d.ts, api/types.d.ts, types-utils.d.ts). No runtime code.

import type { CustomerLoyaltyMetafield, ErrorResponse } from "./shared/loyalty-schema";

// ---------------------------------------------------------------------------
// Case-conversion utility types (from types-utils.d.ts)
// ---------------------------------------------------------------------------

/**
 * Converts a camelCase string type to a snake_case string type.
 */
export type CamelToSnake<S extends string> = S extends `${infer Head}${infer Tail}`
  ? Tail extends Uncapitalize<Tail>
    ? `${Lowercase<Head>}${CamelToSnake<Tail>}`
    : `${Lowercase<Head>}_${CamelToSnake<Tail>}`
  : S;

/**
 * Converts all the keys of an object type to snake_case.
 */
export type SnakeCasedKeys<T> = {
  [K in keyof T as K extends string ? CamelToSnake<K> : K]: T[K];
};

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/**
 * Environment variables required by the easyPoints integration.
 */
export interface LoyaltyEnv {
  EASY_POINTS_API_ENDPOINT?: string;
  EASY_POINTS_API_TOKEN?: string;
}

// ---------------------------------------------------------------------------
// Point / tier rules
// ---------------------------------------------------------------------------

/**
 * Base rule for converting spend into points.
 */
export interface PointRule {
  currencyValue: number;
  percentage: number;
  pointValue: number;
}

/**
 * Tier-specific rule extending the base point conversion rule.
 */
export interface TierRule extends PointRule {
  currencySpentRequirement: number;
  freeShipping: boolean;
  name: string;
}

// ---------------------------------------------------------------------------
// Shop- and customer-level loyalty attributes
// ---------------------------------------------------------------------------

// The shop/customer metafield, tier-maintenance, and REST API response types are *inferred* from
// the Valibot schemas in `./shared/loyalty-schema` so the runtime validation and these exported
// types stay in lockstep. Re-exported here to keep `../types` the single public type surface.
export type {
  AmountCurrency,
  CreateCouponResponse,
  CustomerLoyaltyMetafield,
  CustomerTierMaintenance,
  ErrorResponse,
  ShopLoyaltyValue,
  Tier,
  TierMaintenance,
} from "./shared/loyalty-schema";

/**
 * Loyalty-bearing customer shape exposed to consumers. Replaces the storefront's
 * GraphQL-specific customer types; downstream tier logic keys off this.
 */
export interface LoyaltyCustomer {
  loyalty: CustomerLoyaltyMetafield | null;
}

// ---------------------------------------------------------------------------
// API responses (from api/types.d.ts)
// ---------------------------------------------------------------------------

// `ErrorResponse` and `CreateCouponResponse` are inferred from Valibot schemas — see the re-export
// above. NOTE: `CreateCouponResponse` is camelCase because `api.fetch` runs `keysToCamel` on the
// body before it reaches a consumer (the API itself sends snake_case).

/**
 * Response type from the easyPoints API.
 */
export type ApiResponse<T> = Promise<T | ErrorResponse>;

/**
 * Payload for creating a redeem-points coupon via the easyPoints API.
 */
export interface CreateCouponParams {
  /** Shopify customer ID passed through from form action. */
  customerId: string;
  /** Number of points the customer wants to redeem. */
  pointValue: number;
  /** Unique Shopify product IDs eligible for coupon redemption. */
  productIds: string[];
}
