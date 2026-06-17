// Public type surface for `@lunaris/easypoints-hydrogen`.
//
// Isomorphic and secret-free: domain types ported from solaris-cards-storefront
// (app/lib/easy-points/types.d.ts, api/types.d.ts, types-utils.d.ts). No runtime code.

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

/**
 * Normalized (camelCase) customer-level loyalty attributes from the
 * `easy_points_attributes` metafield.
 */
export interface CustomerLoyaltyMetafield {
  /** Available points balance for the customer. */
  balance: number;
  /** Monetary value used as denominator for point conversion ratios. */
  currencyValue: number;
  /** Current tier identifier/name as provided by loyalty backend. */
  tier: string;
  /** UID of the current tier, used to match rule keys and tier arrays. */
  tierUid: string;
  /** Point value used as numerator for point conversion ratios. */
  pointValue: number;
  /** Tier expiration date (if any). */
  expirationDate: string | null;
  /** Human-readable tier label. */
  tierName: string;
  /** Default earn percentage for the current customer context. */
  percentage: number;
  /** Tier maintenance and advancement data used for progress calculations. */
  tierMaintenanceData: CustomerTierMaintenance;
  /** Whether tax is included in loyalty calculations. */
  includeTax: boolean;
}

/**
 * Loyalty-bearing customer shape exposed to consumers. Replaces the storefront's
 * GraphQL-specific customer types; downstream tier logic keys off this.
 */
export interface LoyaltyCustomer {
  loyalty: CustomerLoyaltyMetafield | null;
}

// ---------------------------------------------------------------------------
// Tier maintenance / advancement
// ---------------------------------------------------------------------------

/**
 * Monetary values in both formatted and numeric forms.
 * `rawAmount` is used by tier progress calculations.
 */
export interface AmountCurrency {
  amount: string | null;
  currency: string;
  rawAmount: number | null;
}

/**
 * Tier entry used when evaluating advancement progression.
 */
export interface Tier extends AmountCurrency {
  uid: string;
  name: string;
  ratio?: number;
  spentRequirement: AmountCurrency;
}

/**
 * Tier requirement payload used for maintenance/advancement checks.
 */
export interface TierMaintenance extends AmountCurrency {
  deadline: string | null;
  spentRequirement: AmountCurrency;
}

/**
 * Group of maintenance and advancement data for the current customer.
 */
export interface CustomerTierMaintenance {
  maintenanceData: TierMaintenance;
  advancementData: TierMaintenance & {
    tierUid: string;
    tierName: string | null;
    tiers: Tier[];
  };
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
