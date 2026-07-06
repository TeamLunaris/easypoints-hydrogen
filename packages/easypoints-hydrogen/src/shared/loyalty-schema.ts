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

// ---------------------------------------------------------------------------
// Shop-level loyalty metafield (snake_case — this metafield is NOT camelCased)
//
// Why snake_case and not `keysToCamel` like the customer metafield: `point_rules` is a record keyed
// by *tier UID* (e.g. `"tier-abc"`), and those UIDs contain dashes. `keysToCamel` recurses into all
// object keys indiscriminately — including record keys — so it would rewrite `"tier-abc"` to
// `"tierAbc"` while the lookup key (`customerLoyalty.tierUid`) stays `"tier-abc"`. The
// `point_rules[tierUid]` lookup in `productPoints` would then miss and silently fall back to the
// default earn rate for every tiered customer. Consuming the value raw keeps the UID keys intact.
// ---------------------------------------------------------------------------

/** Snake-cased base point-conversion rule, exactly as the shop metafield stores it. */
const SnakePointRuleSchema = v.object({
  currency_value: v.number(),
  percentage: v.number(),
  point_value: v.number(),
});

/**
 * Raw (snake_case) shop-level loyalty attributes from the `easy_points_attributes` metafield.
 * Unlike the customer metafield, this value is consumed as-is (no `keysToCamel`), so its keys stay
 * snake_case — `keysToCamel` would also mangle the dashed tier-UID keys of `point_rules` (see the
 * section comment above), so this metafield must not be camelCased.
 */
export const ShopLoyaltyValueSchema = v.object({
  ...SnakePointRuleSchema.entries,
  live: v.boolean(),
  point_rules: v.record(v.string(), SnakePointRuleSchema),
});
export type ShopLoyaltyValue = v.InferOutput<typeof ShopLoyaltyValueSchema>;

/**
 * Parsed `loyalty/bonus_points` metafield for a collection (snake_case, consumed as-is). Drives the
 * `point_value / currency_value` bonus ratio in `productPoints`.
 */
export const CollectionBonusPointsSchema = v.object({
  active: v.boolean(),
  point_value: v.number(),
  currency_value: v.number(),
});
export type CollectionBonusPoints = v.InferOutput<typeof CollectionBonusPointsSchema>;

// ---------------------------------------------------------------------------
// REST API responses (validated AFTER keysToCamel — keys are camelCase)
// ---------------------------------------------------------------------------

/**
 * One entry of the API's `errors` array. Plain strings in most responses; validation failures
 * (422) send `{ title, detail, source }` objects instead. Both normalize to a human-readable
 * string here so `ErrorResponse["errors"]` is always `string[]` for consumers.
 */
const ApiErrorSchema = v.pipe(
  v.union([v.string(), v.object({ title: v.string(), detail: v.optional(v.string()) })]),
  v.transform((error) => (typeof error === "string" ? error : (error.detail ?? error.title))),
);

/** Error response shape from the easyPoints API. */
export const ErrorResponseSchema = v.object({
  errors: v.array(ApiErrorSchema),
  status: v.number(),
  title: v.string(),
});
export type ErrorResponse = v.InferOutput<typeof ErrorResponseSchema>;

/**
 * Response from the coupon-creation endpoint, as it looks AFTER `api.fetch` camelCases the body
 * (the API sends snake_case; `keysToCamel` runs before validation). `data.code` is applied as the
 * cart discount code on a successful redemption.
 */
export const CreateCouponResponseSchema = v.object({
  data: v.object({
    code: v.string(),
    currencyValue: v.number(),
    expiresAt: v.string(),
    id: v.number(),
    pointValue: v.number(),
    pointsReimbursed: v.number(),
    posDiscount: v.boolean(),
    reimbursementCascade: v.boolean(),
  }),
});
export type CreateCouponResponse = v.InferOutput<typeof CreateCouponResponseSchema>;
