// Client (browser-safe) entry for `@lunaris/easypoints-hydrogen`.
//
// Re-exports the headless React building blocks, hooks, optional provider, and isomorphic
// utilities. Ported in the follow-up phase from solaris-cards-storefront
// (app/components/points/, app/hooks/useCartPoints.ts, app/lib/easy-points/tiers.ts).
//
// INVARIANT: this entry must never import from "./server" — keeps the API token and any
// server-only code out of the browser bundle.

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
