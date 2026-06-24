// Customer loyalty fixtures, validated against the real Valibot schema so they cannot drift out of
// shape. `loyaltyMetafield` parses its built value against `CustomerLoyaltyMetafieldValueSchema`
// (the camelCase, post-`keysToCamel` shape) and then layers on the `customerId` the schema omits.

import * as v from "valibot";

import { CustomerLoyaltyMetafieldValueSchema } from "../../shared/loyalty-schema";

import type { AmountCurrency, CustomerLoyaltyMetafield, LoyaltyCustomer, Tier } from "../../types";

/** Monetary value in formatted + numeric form. `null` raw yields a `null`-amount currency. */
export const amount = (raw: number | null): AmountCurrency => ({
  amount: raw === null ? null : String(raw),
  currency: "JPY",
  rawAmount: raw,
});

/** Advancement tier entry; `raw` is its spend requirement. */
export const tier = (uid: string, name: string, raw: number, ratio = 0.01): Tier => ({
  ...amount(raw),
  uid,
  name,
  ratio,
  spentRequirement: amount(raw),
});

type LoyaltyOverrides = Partial<CustomerLoyaltyMetafield> & {
  /** Spend still owed on the current tier (drives `tierMaintenanceData.maintenanceData`). */
  maintenanceRaw?: number | null;
  /** Advancement tier list surfaced under `advancementData.tiers`. */
  tiers?: Tier[];
};

/**
 * A complete, schema-valid `CustomerLoyaltyMetafield`. Pass `maintenanceRaw` / `tiers` to shape the
 * tier-maintenance data, or any metafield field (e.g. `balance`) to override a default.
 */
export function loyaltyMetafield(overrides: LoyaltyOverrides = {}): CustomerLoyaltyMetafield {
  const {
    maintenanceRaw = 0,
    tiers = [],
    customerId = "gid://shopify/Customer/1",
    ...rest
  } = overrides;

  const value = v.parse(CustomerLoyaltyMetafieldValueSchema, {
    balance: 1000,
    currencyValue: 100,
    tier: "Silver",
    tierUid: "tier-current",
    pointValue: 1,
    expirationDate: null,
    tierName: "Silver",
    percentage: 1,
    includeTax: false,
    tierMaintenanceData: {
      maintenanceData: {
        ...amount(maintenanceRaw),
        deadline: "2026-12-31",
        spentRequirement: amount(maintenanceRaw),
      },
      advancementData: {
        ...amount(0),
        deadline: "2027-06-30",
        spentRequirement: amount(0),
        tierUid: "tier-next",
        tierName: "Gold",
        tiers,
      },
    },
    ...rest,
  });

  return { ...value, customerId };
}

/** Wraps `loyaltyMetafield` as the `{ loyalty }` customer the tier functions consume. */
export const loyaltyCustomer = (overrides: LoyaltyOverrides = {}): LoyaltyCustomer => ({
  loyalty: loyaltyMetafield(overrides),
});

/** Minimal account fixture for hooks that only read `.balance`; still a full, valid metafield. */
export const account = (balance: number): CustomerLoyaltyMetafield => loyaltyMetafield({ balance });
