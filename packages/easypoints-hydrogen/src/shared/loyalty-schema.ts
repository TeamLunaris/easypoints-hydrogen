// Isomorphic, secret-free Valibot schemas for the customer `easy_points_attributes` metafield.
//
// These schemas are the single source of truth for the metafield/tier-maintenance type cluster:
// the public types in `../types` are *inferred* from them (`v.InferOutput`), so the runtime
// validation and the exported types can never drift. Browser-safe — Valibot is isomorphic — but
// the schema *values* are only imported at runtime by `server/loyalty-customer.ts`, so they
// tree-shake out of the browser (`index`/`client`) bundles, which import the types only.
//
// Keys are validated AFTER `keysToCamel`, so every field here is camelCase even though the API
// returns snake_case.

import * as v from "valibot";

/** Monetary value in both formatted and numeric (`rawAmount`) forms. */
export const AmountCurrencySchema = v.object({
  amount: v.nullable(v.string()),
  currency: v.string(),
  rawAmount: v.nullable(v.number()),
});

/** Tier entry used when evaluating advancement progression. */
export const TierSchema = v.object({
  ...AmountCurrencySchema.entries,
  uid: v.string(),
  name: v.string(),
  ratio: v.optional(v.number()),
  spentRequirement: AmountCurrencySchema,
});

/** Tier requirement payload used for maintenance/advancement checks. */
export const TierMaintenanceSchema = v.object({
  ...AmountCurrencySchema.entries,
  deadline: v.nullable(v.string()),
  spentRequirement: AmountCurrencySchema,
});

/** Group of maintenance and advancement data for the current customer. */
export const CustomerTierMaintenanceSchema = v.object({
  maintenanceData: TierMaintenanceSchema,
  advancementData: v.object({
    ...TierMaintenanceSchema.entries,
    tierUid: v.string(),
    tierName: v.nullable(v.string()),
    tiers: v.array(TierSchema),
  }),
});

/**
 * The normalized (camelCase) customer loyalty metafield, exactly as the JSON `easy_points_attributes`
 * value parses into. NOTE: `customerId` is intentionally absent — it is not part of the metafield
 * JSON; `queryCustomerLoyalty` injects the session-authenticated GID after validation.
 */
export const CustomerLoyaltyMetafieldValueSchema = v.object({
  balance: v.number(),
  currencyValue: v.number(),
  tier: v.string(),
  tierUid: v.string(),
  pointValue: v.number(),
  expirationDate: v.nullable(v.string()),
  tierName: v.string(),
  percentage: v.number(),
  tierMaintenanceData: CustomerTierMaintenanceSchema,
  includeTax: v.boolean(),
});

export type AmountCurrency = v.InferOutput<typeof AmountCurrencySchema>;
export type Tier = v.InferOutput<typeof TierSchema>;
export type TierMaintenance = v.InferOutput<typeof TierMaintenanceSchema>;
export type CustomerTierMaintenance = v.InferOutput<typeof CustomerTierMaintenanceSchema>;

/**
 * Normalized (camelCase) customer-level loyalty attributes from the `easy_points_attributes`
 * metafield, plus the session-authenticated `customerId` injected by `queryCustomerLoyalty`.
 */
export type CustomerLoyaltyMetafield = v.InferOutput<typeof CustomerLoyaltyMetafieldValueSchema> & {
  /** Session-authenticated Shopify customer GID (`gid://shopify/Customer/…`). */
  customerId: string;
};
