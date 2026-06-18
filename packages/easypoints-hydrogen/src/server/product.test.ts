import { expect, test } from "vite-plus/test";

import { PRODUCT_LOYALTY_QUERY, SHOP_LOYALTY_QUERY } from "./graphql";
import { productPoints } from "./product";

import type { EasyPointsClient } from "./loyalty";
import type { CustomerLoyaltyMetafield, ShopLoyaltyValue } from "../types";
import type { Storefront } from "@shopify/hydrogen";

interface CollectionFixture {
  id: string;
  bonusPoints: { value: string } | null;
}

interface Fixtures {
  /** Variant price as the GraphQL string amount (e.g. `"10.00"`). */
  priceAmount: string;
  shopLoyalty: ShopLoyaltyValue | null;
  collections?: CollectionFixture[];
  customerLoyalty?: CustomerLoyaltyMetafield | null;
}

/**
 * Builds an `EasyPointsClient` whose `storefront.query` answers the shop + product loyalty queries
 * from the supplied fixtures, and whose `getCustomerLoyalty` resolves the supplied customer.
 */
function makeLoyalty({
  priceAmount,
  shopLoyalty,
  collections = [],
  customerLoyalty = null,
}: Fixtures): EasyPointsClient {
  const storefront = {
    CacheLong: () => ({}),
    query: async (query: string) => {
      if (query === SHOP_LOYALTY_QUERY) {
        return {
          shop: { loyalty: shopLoyalty ? { value: JSON.stringify(shopLoyalty) } : null },
        };
      }
      if (query === PRODUCT_LOYALTY_QUERY) {
        return {
          product: {
            id: "gid://shopify/Product/1",
            selectedOrFirstAvailableVariant: {
              price: { amount: priceAmount, currencyCode: "USD" },
            },
            collections: { nodes: collections },
          },
        };
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  } as unknown as Storefront;

  return {
    context: () => ({ storefront, customerAccount: {} as never }),
    getCustomerLoyalty: async () => customerLoyalty,
  } as unknown as EasyPointsClient;
}

/** Minimal shop loyalty value; only `percentage` + `point_rules` matter for the math. */
function shopValue(
  percentage: number,
  pointRules: ShopLoyaltyValue["point_rules"] = {},
): ShopLoyaltyValue {
  return {
    live: true,
    percentage,
    currency_value: 100,
    point_value: 1,
    point_rules: pointRules,
  };
}

/** Builds an active-collection bonus node with the given point/currency ratio. */
function bonusCollection(id: string, pointValue: number, currencyValue: number, active = true) {
  return {
    id,
    bonusPoints: {
      value: JSON.stringify({ active, point_value: pointValue, currency_value: currencyValue }),
    },
  };
}

const args = { handle: "a-product", selectedOptions: [], quantity: 1 };

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

test("quantity scales the total and floor is applied to the line, not the unit", async () => {
  // price 2.50 -> 250 cents; 1% -> raw 2.5 per unit. singlePoints = floor(2.5) = 2;
  // totalPoints = floor(2.5 * 3) = floor(7.5) = 7 (not 2 * 3 = 6).
  const loyalty = makeLoyalty({ priceAmount: "2.50", shopLoyalty: shopValue(1) });

  const result = await productPoints(loyalty, { ...args, quantity: 3 });

  expect(result).toEqual({ totalPoints: 7, singlePoints: 2 });
});
