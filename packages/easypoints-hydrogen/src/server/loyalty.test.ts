import { InMemoryCache } from "@shopify/hydrogen";
import { describe, expect, test, vi } from "vite-plus/test";

import { EasyPointsClientError } from "./errors";
import { createEasyPointsClient } from "./loyalty";

import { couponResponse, errorResponse } from "../test-support/fixtures/coupon";
import { jsonResponse, setupFetchMock } from "../test-support/http";

const fetchMock = setupFetchMock();

function makeClient() {
  return createEasyPointsClient({
    cache: new InMemoryCache(),
    waitUntil: () => {},
    request: new Request("https://shop.example/loyalty"),
    token: "test-token",
  });
}

describe("api.fetch", () => {
  test("2xx responses are camelCased", async () => {
    fetchMock.mock(async () => jsonResponse({ point_value: 5, currency_value: 100 }));

    const result = await makeClient().api.fetch<{ pointValue: number; currencyValue: number }>(
      "/whatever",
      { method: "GET" },
    );

    expect(result).toEqual({ pointValue: 5, currencyValue: 100 });
  });

  test("4xx responses return a (camelCased) ErrorResponse rather than throwing", async () => {
    const error = errorResponse({ errors: ["bad_request"], status: 400, title: "Bad Request" });
    fetchMock.mock(async () => jsonResponse(error, { status: 400 }));

    const result = await makeClient().api.fetch("/whatever", { method: "GET" });

    expect(result).toEqual(error);
  });

  test("4xx with an unparseable body synthesizes an ErrorResponse from the status line", async () => {
    // Non-JSON 4xx body: `withCache.fetch` returns `data: null` and `response.json()` rejects,
    // so `errorBody` is null and the client falls back to the status text.
    fetchMock.mock(async () => new Response("not json", { status: 404, statusText: "Not Found" }));

    const result = await makeClient().api.fetch("/whatever", { method: "GET" });

    expect(result).toEqual({ errors: [], status: 404, title: "Not Found" });
  });

  test("4xx with an unparseable body and no status text falls back to a default title", async () => {
    // Some runtimes give an empty `statusText`; the client should still produce a usable title.
    fetchMock.mock(async () => new Response("", { status: 400, statusText: "" }));

    const result = await makeClient().api.fetch("/whatever", { method: "GET" });

    expect(result).toEqual({ errors: [], status: 400, title: "Request failed" });
  });

  test("5xx responses throw EasyPointsClientError", async () => {
    fetchMock.mock(async () =>
      jsonResponse({ errors: ["boom"] }, { status: 500, statusText: "Server Error" }),
    );

    await expect(makeClient().api.fetch("/whatever", { method: "GET" })).rejects.toBeInstanceOf(
      EasyPointsClientError,
    );
  });

  test("429 responses retry honoring Retry-After, then succeed", async () => {
    const spy = fetchMock.mockOnce(
      jsonResponse({}, { status: 429, headers: { "Retry-After": "0" } }),
      jsonResponse({ point_value: 7 }, { status: 200 }),
    );

    const result = await makeClient().api.fetch<{ pointValue: number }>("/whatever", {
      method: "GET",
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ pointValue: 7 });
  });

  test("429 stops retrying after the max attempts and returns the ErrorResponse", async () => {
    const error = errorResponse({
      errors: ["rate_limited"],
      status: 429,
      title: "Too Many Requests",
    });
    const spy = fetchMock.mock(async () =>
      jsonResponse(error, { status: 429, headers: { "Retry-After": "0" } }),
    );

    const result = await makeClient().api.fetch("/whatever", { method: "GET" });

    // initial attempt + MAX_RETRY_ATTEMPTS (2) retries = 3 calls
    expect(spy).toHaveBeenCalledTimes(3);
    expect(result).toEqual(error);
  });
});

describe("api.createCoupon", () => {
  test("serializes its payload to snake_case and surfaces a camelCased response", async () => {
    // The API replies in snake_case; `api.fetch` camelCases it before schema validation.
    const spy = fetchMock.mock(async () =>
      jsonResponse({
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
      }),
    );

    const result = await makeClient().api.createCoupon({
      customerId: "gid://shopify/Customer/1",
      pointValue: 500,
      productIds: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
    });

    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://loyalty.slrs.io/api/shopify/coupons");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      customer_id: "gid://shopify/Customer/1",
      point_value: 500,
      product_ids: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
    });

    // The response is schema-validated and surfaced camelCase — matches the coupon fixture defaults.
    expect(result).toEqual(couponResponse());
  });

  test("returns an ErrorResponse when the 2xx body fails schema validation", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // 200 OK, but the coupon payload is malformed (missing every `data` field).
    fetchMock.mock(async () => jsonResponse({ data: { code: "ABC123" } }));

    const result = await makeClient().api.createCoupon({
      customerId: "gid://shopify/Customer/1",
      pointValue: 500,
      productIds: ["gid://shopify/Product/1"],
    });

    expect(result).toEqual(
      errorResponse({ status: 200, title: "Invalid response from loyalty API" }),
    );
    expect(errorSpy).toHaveBeenCalled();
  });
});
