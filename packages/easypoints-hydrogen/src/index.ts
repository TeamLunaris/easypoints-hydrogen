// Root (browser-safe) entry for `@lunaris/easypoints-hydrogen`.
//
// Re-exports the secret-free isomorphic surface — domain types, the `keysToCamel` case utility, and
// the tier logic shared by client and server — plus the headless render-prop components. The
// granular hooks + provider live on `./client`; server-only code lives on `./server`.
//
// INVARIANT: this entry must never import from "./server" — keeps the API token and any
// server-only code out of the browser bundle. (The components' cart-points route coupling is type-only, and
// React is an external peer, so neither server code nor React is bundled here.)

export type * from "./types";
export { keysToCamel } from "./shared/case";
export { getCurrentTier, getMaintenanceTier, getNextTier, getProgressTier } from "./shared/tiers";

// Headless render-prop components. Thin children-as-function wrappers over the client hooks: they
// render no markup, apply no styling, and (apart from `ProductPoints`'s locale-formatted count) do
// no formatting — they hand raw values to the consumer to render.
export { ProductPoints } from "./client/components/ProductPoints";
export type {
  ProductPointsProps,
  ProductPointsRenderProps,
} from "./client/components/ProductPoints";
export { TierProgress } from "./client/components/TierProgress";
export type { TierProgressProps, TierProgressRenderProps } from "./client/components/TierProgress";
export { CartRedemption } from "./client/components/CartRedemption";
export type {
  CartRedemptionProps,
  CartRedemptionRenderProps,
} from "./client/components/CartRedemption";
export { CustomerLoyalty } from "./client/components/CustomerLoyalty";
export type {
  CustomerLoyaltyProps,
  CustomerLoyaltyRenderProps,
} from "./client/components/CustomerLoyalty";
