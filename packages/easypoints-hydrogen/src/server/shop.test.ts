import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { parseLoyaltyAttributes } from "./shop";

import { SHOP_VALUE } from "../test-support/fixtures/shop";

/** Wraps a metafield value in the `ShopLoyalty` query response shape. */
const response = (value: string | null | undefined) => ({
  shop: {
    loyalty: value === undefined ? undefined : value === null ? null : { value } },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseLoyaltyAttributes", () => {
  test("parses a complete shop loyalty metafield", () => {
    const resp = response(SHOP_VALUE);

    expect(parseLoyaltyAttributes(resp)).toEqual({
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
    const resp = response(null);
    expect(parseLoyaltyAttributes(resp)).toBe(null);
  });

  test("returns null when the metafield value is empty", () => {
    const resp = response("");
    expect(parseLoyaltyAttributes(resp)).toBe(null);
  });

  test("returns null when the value is not valid JSON", () => {
    const resp = response("not json");
    expect(parseLoyaltyAttributes(resp)).toBe(null);
  });

  test("returns null and logs when the metafield shape is invalid", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Valid JSON, wrong shape: `point_rules` missing — would throw in productPoints if trusted.
    const resp = response(JSON.stringify({
      live: true,
      currency_value: 100,
      percentage: 1,
      point_value: 1,
    }));

    expect(parseLoyaltyAttributes(resp)).toBe(null);
    expect(errorSpy).toHaveBeenCalled();
  });
});
