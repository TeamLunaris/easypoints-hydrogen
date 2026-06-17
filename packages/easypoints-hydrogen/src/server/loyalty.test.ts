import { InMemoryCache } from "@shopify/hydrogen";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import { LoyaltyClientError } from "./errors";
import { createEasyPointsClient } from "./loyalty";

import type { CreateCouponResponse } from "../types";

const jsonResponse = (
  body: unknown,
  init?: { status?: number; statusText?: string; headers?: Record<string, string> },
) =>
  new Response(JSON.stringify(body), {
    status: init?.status,
    statusText: init?.statusText,
    headers: { "content-type": "application/json", ...init?.headers },
  });

function makeClient() {
  return createEasyPointsClient({
    cache: new InMemoryCache(),
    waitUntil: () => {},
    request: new Request("https://shop.example/loyalty"),
    token: "test-token",
  });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

test("2xx responses are camelCased", async () => {
  globalThis.fetch = vi.fn(async () =>
    jsonResponse({ point_value: 5, currency_value: 100 }, { status: 200 }),
  ) as typeof fetch;

  const client = makeClient();
  const result = await client.api.fetch<{ pointValue: number; currencyValue: number }>(
    "/whatever",
    {
      method: "GET",
    },
  );

  expect(result).toEqual({ pointValue: 5, currencyValue: 100 });
});

test("4xx responses return a (camelCased) ErrorResponse rather than throwing", async () => {
  globalThis.fetch = vi.fn(async () =>
    jsonResponse({ errors: ["bad_request"], status: 400, title: "Bad Request" }, { status: 400 }),
  ) as typeof fetch;

  const client = makeClient();
  const result = await client.api.fetch("/whatever", { method: "GET" });

  expect(result).toEqual({ errors: ["bad_request"], status: 400, title: "Bad Request" });
});

test("5xx responses throw LoyaltyClientError", async () => {
  globalThis.fetch = vi.fn(async () =>
    jsonResponse({ errors: ["boom"] }, { status: 500, statusText: "Server Error" }),
  ) as typeof fetch;

  const client = makeClient();

  await expect(client.api.fetch("/whatever", { method: "GET" })).rejects.toBeInstanceOf(
    LoyaltyClientError,
  );
});

test("429 responses retry honoring Retry-After, then succeed", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse({}, { status: 429, headers: { "Retry-After": "0" } }))
    .mockResolvedValueOnce(jsonResponse({ point_value: 7 }, { status: 200 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const client = makeClient();
  const result = await client.api.fetch<{ pointValue: number }>("/whatever", { method: "GET" });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result).toEqual({ pointValue: 7 });
});

test("429 stops retrying after the max attempts and returns the ErrorResponse", async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse(
      { errors: ["rate_limited"], status: 429, title: "Too Many Requests" },
      {
        status: 429,
        headers: { "Retry-After": "0" },
      },
    ),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const client = makeClient();
  const result = await client.api.fetch("/whatever", { method: "GET" });

  // initial attempt + MAX_RETRY_ATTEMPTS (2) retries = 3 calls
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(result).toEqual({ errors: ["rate_limited"], status: 429, title: "Too Many Requests" });
});

test("createCoupon serializes its payload to snake_case", async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse(
      {
        data: {
          code: "ABC123",
          currency_value: 100,
          expires_at: "2026-12-31",
          id: 1,
          point_value: 500,
          points_reimbursed: 0,
          pos_discount: false,
          reimbursement_cascade: false,
        },
      } satisfies CreateCouponResponse,
      { status: 200 },
    ),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const client = makeClient();
  await client.api.createCoupon({
    customerId: "gid://shopify/Customer/1",
    pointValue: 500,
    productIds: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
  });

  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://loyalty.slrs.io/api/shopify/coupons");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual({
    customer_id: "gid://shopify/Customer/1",
    point_value: 500,
    product_ids: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
  });
});
