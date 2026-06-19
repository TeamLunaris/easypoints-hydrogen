// Public type surface for `@lunaris/easypoints-hydrogen`.
//
// Isomorphic and secret-free: domain types ported from solaris-cards-storefront
// (app/lib/easy-points/types.d.ts, api/types.d.ts, types-utils.d.ts). No runtime code.

import type { CustomerLoyaltyMetafield } from "./shared/loyalty-schema";

// ---------------------------------------------------------------------------
// Case-conversion utility types (from types-utils.d.ts)
// ---------------------------------------------------------------------------

/**
 * Converts a camelCase string type to a snake_case string type.
 */
export type CamelToSnake<S extends string> = S extends `${infer Head}${infer Tail}`
  ? Tail extends Uncapitalize<Tail>
    ? `${Lowercase<Head>}${CamelToSnake<Tail>}`
    : `${Lowercase<Head>}_${CamelToSnake<Tail>}`
  : S;

/**
 * Converts all the keys of an object type to snake_case.
 */
export type SnakeCasedKeys<T> = {
  [K in keyof T as K extends string ? CamelToSnake<K> : K]: T[K];
};

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/**
 * Environment variables required by the easyPoints integration.
 */
export interface LoyaltyEnv {
  EASY_POINTS_API_ENDPOINT?: string;
  EASY_POINTS_API_TOKEN?: string;
}

// ---------------------------------------------------------------------------
// Point / tier rules
// ---------------------------------------------------------------------------

/**
 * Base rule for converting spend into points.
 */
export interface PointRule {
  currencyValue: number;
  percentage: number;
  pointValue: number;
}

/**
 * Tier-specific rule extending the base point conversion rule.
 */
export interface TierRule extends PointRule {
  currencySpentRequirement: number;
  freeShipping: boolean;
  name: string;
}

// ---------------------------------------------------------------------------
// Shop- and customer-level loyalty attributes
// ---------------------------------------------------------------------------

/**
 * Raw (snake_case) shop-level loyalty attributes from the `easy_points_attributes` metafield.
 */
export interface ShopLoyaltyValue extends SnakeCasedKeys<PointRule> {
  /** Feature flag indicating whether the loyalty program is active. */
  live: boolean;
  /** Tier UID -> tier rule mapping, preserving API snake_case keys. */
  point_rules: Record<string, SnakeCasedKeys<PointRule>>;
}

// The customer metafield + tier-maintenance type cluster is *inferred* from the Valibot schemas
// in `./shared/loyalty-schema` so the runtime validation and these exported types stay in lockstep.
// Re-exported here to keep `../types` the single public type surface for consumers.
export type {
  AmountCurrency,
  CustomerLoyaltyMetafield,
  CustomerTierMaintenance,
  Tier,
  TierMaintenance,
} from "./shared/loyalty-schema";

/**
 * Loyalty-bearing customer shape exposed to consumers. Replaces the storefront's
 * GraphQL-specific customer types; downstream tier logic keys off this.
 */
export interface LoyaltyCustomer {
  loyalty: CustomerLoyaltyMetafield | null;
}

// ---------------------------------------------------------------------------
// API responses (from api/types.d.ts)
// ---------------------------------------------------------------------------

/**
 * Error response shape from the easyPoints API.
 */
export interface ErrorResponse {
  errors: string[];
  status: number;
  title: string;
}

/**
 * Response type from the easyPoints API.
 */
export type ApiResponse<T> = Promise<T | ErrorResponse>;

/**
 * Payload for creating a redeem-points coupon via the easyPoints API.
 */
export interface CreateCouponParams {
  /** Shopify customer ID passed through from form action. */
  customerId: string;
  /** Number of points the customer wants to redeem. */
  pointValue: number;
  /** Unique Shopify product IDs eligible for coupon redemption. */
  productIds: string[];
}

/**
 * Response shape from the easyPoints coupon creation endpoint.
 * `data.code` is applied as a cart discount code after successful redemption.
 */
export interface CreateCouponResponse {
  data: {
    code: string;
    currency_value: number;
    expires_at: string;
    id: number;
    point_value: number;
    points_reimbursed: number;
    pos_discount: boolean;
    reimbursement_cascade: boolean;
  };
}
