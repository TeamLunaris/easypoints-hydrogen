import { afterEach, expect, test, vi } from "vite-plus/test";

import { parseLoyaltyAttributes } from "./shop";

/** A complete (snake_case) shop metafield value as the Storefront API returns it. */
const SHOP_VALUE = JSON.stringify({
  live: true,
  currency_value: 100,
  percentage: 1,
  point_value: 1,
  point_rules: {
    "tier-abc": { currency_value: 100, percentage: 2, point_value: 1 },
  },
});

/** Wraps a metafield value in the `ShopLoyalty` query response shape. */
const response = (value: string | null | undefined) => ({
  shop: { loyalty: value === undefined ? undefined : value === null ? null : { value } },
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("parses a complete shop loyalty metafield", () => {
  expect(parseLoyaltyAttributes(response(SHOP_VALUE))).toEqual({
    live: true,
    currency_value: 100,
    percentage: 1,
    point_value: 1,
    point_rules: {
      "tier-abc": { currency_value: 100, percentage: 2, point_value: 1 },
    },
  });
});

test("returns null when the metafield is absent", () => {
  expect(parseLoyaltyAttributes(response(null))).toBe(null);
});

test("returns null when the metafield value is empty", () => {
  expect(parseLoyaltyAttributes(response(""))).toBe(null);
});

test("returns null when the value is not valid JSON", () => {
  expect(parseLoyaltyAttributes(response("not json"))).toBe(null);
});

test("returns null and logs when the metafield shape is invalid", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  // Valid JSON, wrong shape: `point_rules` missing — would throw in productPoints if trusted.
  const invalid = JSON.stringify({
    live: true,
    currency_value: 100,
    percentage: 1,
    point_value: 1,
  });

  expect(parseLoyaltyAttributes(response(invalid))).toBe(null);
  expect(errorSpy).toHaveBeenCalled();
});
