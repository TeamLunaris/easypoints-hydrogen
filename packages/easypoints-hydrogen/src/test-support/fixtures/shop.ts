// Shop-level loyalty fixtures (snake_case — these metafields are consumed without `keysToCamel`),
// validated against their Valibot schemas.

import * as v from "valibot";

import { CollectionBonusPointsSchema, ShopLoyaltyValueSchema } from "../../shared/loyalty-schema";

import type { ShopLoyaltyValue } from "../../types";

/** A valid shop loyalty value; `percentage` + `point_rules` are what the points math reads. */
export function shopValue(
  percentage = 1,
  pointRules: ShopLoyaltyValue["point_rules"] = {},
): ShopLoyaltyValue {
  return v.parse(ShopLoyaltyValueSchema, {
    live: true,
    percentage,
    currency_value: 100,
    point_value: 1,
    point_rules: pointRules,
  });
}

/** The shop metafield as the Storefront API returns it (JSON string), with one tier rule. */
export const SHOP_VALUE = JSON.stringify(
  shopValue(1, { "tier-abc": { currency_value: 100, percentage: 2, point_value: 1 } }),
);

/** An active-collection bonus node carrying the given point/currency ratio. */
export function bonusCollection(
  id: string,
  pointValue: number,
  currencyValue: number,
  active = true,
) {
  const value = v.parse(CollectionBonusPointsSchema, {
    active,
    point_value: pointValue,
    currency_value: currencyValue,
  });
  return { id, bonusPoints: { value: JSON.stringify(value) } };
}
