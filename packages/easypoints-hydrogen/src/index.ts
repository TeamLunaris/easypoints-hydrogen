// Root (browser-safe) entry for `@lunaris/easypoints-hydrogen`.
//
// Re-exports the secret-free isomorphic surface — domain types, the `keysToCamel` case utility, and
// the tier logic shared by client and server — plus the headless render-prop components (D6). The
// granular hooks + provider live on `./client`; server-only code lives on `./server`.
//
// INVARIANT: this entry must never import from "./server" — keeps the API token and any
// server-only code out of the browser bundle. (The components' D4 route coupling is type-only, and
// React is an external peer, so neither server code nor React is bundled here.)

export type * from "./types";
export { keysToCamel } from "./shared/case";
export {
  findTierIndex,
  getCurrentTier,
  getMaintenanceTier,
  getNextTier,
  getProgressTier,
  getTierRule,
  sortTierRules,
} from "./shared/tiers";

// Headless render-prop components (D6). Thin children-as-function wrappers over the D5 hooks: they
// render no markup, apply no styling, and (apart from `ProductPoints`'s locale-formatted count) do
// no formatting — they hand raw values to the consumer to render.
export { ProductPoints } from "./client/components/ProductPoints";
export type {
  ProductPointsProps,
  ProductPointsRenderProps,
} from "./client/components/ProductPoints";
export { TierProgress } from "./client/components/TierProgress";
export type { TierProgressProps, TierProgressRenderProps } from "./client/components/TierProgress";
export { PointsRedemption } from "./client/components/PointsRedemption";
export type {
  PointsRedemptionProps,
  PointsRedemptionRenderProps,
} from "./client/components/PointsRedemption";
export { CustomerLoyalty } from "./client/components/CustomerLoyalty";
export type {
  CustomerLoyaltyProps,
  CustomerLoyaltyRenderProps,
} from "./client/components/CustomerLoyalty";
