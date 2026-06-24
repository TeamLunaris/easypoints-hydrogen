import { describe, expect, test } from "vite-plus/test";

import { productPoints } from "./product";

import { makeLoyaltyClient } from "../test-support/context";
import { bonusCollection, shopValue } from "../test-support/fixtures/shop";

import type { EasyPointsClient } from "./loyalty";
import type { CustomerLoyaltyMetafield } from "../types";

type LoyaltyFixture = Parameters<typeof makeLoyaltyClient>[0];

/** The `EasyPointsClient` `productPoints` consumes, built from the storefront/customer fixtures. */
const makeLoyalty = (fixture: LoyaltyFixture): EasyPointsClient =>
  makeLoyaltyClient(fixture).loyalty;

const args = { handle: "a-product", selectedOptions: [], quantity: 1 };

describe("productPoints", () => {
  test("base points math for a single line", async () => {
    // price 10.00 -> 1000 cents; 5% -> rate 0.05; 1000 * 0.05 = 50
    const loyalty = makeLoyalty({ priceAmount: "10.00", shopLoyalty: shopValue(5) });

    const result = await productPoints(loyalty, args);

    expect(result).toEqual({ totalPoints: 50, singlePoints: 50 });
  });

  test("per-tier percentage override is applied via point_rules[tierUid]", async () => {
    // shop default 1%, but the customer's tier overrides to 10% -> 1000 * 0.10 = 100
    const loyalty = makeLoyalty({
      priceAmount: "10.00",
      shopLoyalty: shopValue(1, {
        "tier-gold": { percentage: 10, currency_value: 100, point_value: 1 },
      }),
      customerLoyalty: { tierUid: "tier-gold" } as unknown as CustomerLoyaltyMetafield,
    });

    const result = await productPoints(loyalty, args);

    expect(result).toEqual({ totalPoints: 100, singlePoints: 100 });
  });

  test("collection maxCollectionBonusRatio is folded into the rate", async () => {
    // 1% base + max active bonus ratio. Two active collections (0.02, 0.05) and one inactive (0.10)
    // -> max active 0.05; rate = 0.01 + 0.05 = 0.06; 1000 * 0.06 = 60
    const loyalty = makeLoyalty({
      priceAmount: "10.00",
      shopLoyalty: shopValue(1),
      collections: [
        bonusCollection("c1", 2, 100),
        bonusCollection("c2", 5, 100),
        bonusCollection("c3", 10, 100, false),
      ],
    });

    const result = await productPoints(loyalty, args);

    expect(result).toEqual({ totalPoints: 60, singlePoints: 60 });
  });

  test("a collection with an unparseable bonusPoints value is skipped, not fatal", async () => {
    // The malformed collection must be dropped (its JSON.parse throws) while the valid one still
    // counts -- otherwise the throw would bubble to productPoints' catch and yield null.
    // 1% base + valid active bonus 0.05; rate = 0.06; 1000 * 0.06 = 60.
    const loyalty = makeLoyalty({
      priceAmount: "10.00",
      shopLoyalty: shopValue(1),
      collections: [
        { id: "bad", bonusPoints: { value: "{not valid json" } },
        bonusCollection("c1", 5, 100),
      ],
    });

    const result = await productPoints(loyalty, args);

    expect(result).toEqual({ totalPoints: 60, singlePoints: 60 });
  });

  test("a collection with a valid-JSON but wrong-shape bonusPoints value is skipped", async () => {
    // Valid JSON, wrong shape (no point_value/currency_value): if trusted it would compute a NaN
    // ratio that the `>=` comparison swallows. It must be dropped, leaving only the valid bonus.
    // 1% base + valid active bonus 0.05; rate = 0.06; 1000 * 0.06 = 60.
    const loyalty = makeLoyalty({
      priceAmount: "10.00",
      shopLoyalty: shopValue(1),
      collections: [
        { id: "bad", bonusPoints: { value: JSON.stringify({ active: true, foo: "bar" }) } },
        bonusCollection("c1", 5, 100),
      ],
    });

    const result = await productPoints(loyalty, args);

    expect(result).toEqual({ totalPoints: 60, singlePoints: 60 });
  });

  test("quantity scales the total and floor is applied to the line, not the unit", async () => {
    // price 2.50 -> 250 cents; 1% -> raw 2.5 per unit. singlePoints = floor(2.5) = 2;
    // totalPoints = floor(2.5 * 3) = floor(7.5) = 7 (not 2 * 3 = 6).
    const loyalty = makeLoyalty({ priceAmount: "2.50", shopLoyalty: shopValue(1) });

    const result = await productPoints(loyalty, { ...args, quantity: 3 });

    expect(result).toEqual({ totalPoints: 7, singlePoints: 2 });
  });

  // Minor-unit conversion derives the decimal count from the MoneyV2 currencyCode instead of
  // hardcoding `price * 100`, so points are correct for non-2-decimal currencies and free of the
  // float drift that `amount * 100` would otherwise leak into `Math.floor`.
  test("zero-decimal currency (JPY) is not multiplied by 100", async () => {
    // JPY has 0 minor-unit decimals: "1000" already IS the minor amount. 5% -> floor(1000 * 0.05)
    // = 50. (Hardcoding * 100 would give 1000 * 100 = 100000 -> floor(5000) = 5000, 100x too high.)
    const loyalty = makeLoyalty({
      priceAmount: "1000",
      currencyCode: "JPY",
      shopLoyalty: shopValue(5),
    });

    const result = await productPoints(loyalty, args);

    expect(result).toEqual({ totalPoints: 50, singlePoints: 50 });
  });

  test("three-decimal currency (BHD) uses 1000 minor units", async () => {
    // BHD has 3 minor-unit decimals: 1.500 BHD -> 1500 fils. 10% -> floor(1500 * 0.10) = 150.
    const loyalty = makeLoyalty({
      priceAmount: "1.500",
      currencyCode: "BHD",
      shopLoyalty: shopValue(10),
    });

    const result = await productPoints(loyalty, args);

    expect(result).toEqual({ totalPoints: 150, singlePoints: 150 });
  });

  test("2-decimal amount converts to minor units without float drift", async () => {
    // 19.99 USD -> 1999 cents. At 100% the points equal the minor amount: floor(1999 * 1.0) = 1999.
    // (A naive 19.99 * 100 = 1998.9999999999998 -> floor = 1998 would be off by one.)
    const loyalty = makeLoyalty({ priceAmount: "19.99", shopLoyalty: shopValue(100) });

    const result = await productPoints(loyalty, args);

    expect(result).toEqual({ totalPoints: 1999, singlePoints: 1999 });
  });
});
