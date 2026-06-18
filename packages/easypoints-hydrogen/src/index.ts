// Root (isomorphic, browser-safe) entry for `@lunaris/easypoints-hydrogen`.
//
// Re-exports the secret-free isomorphic surface: domain types, the `keysToCamel` case utility, and
// the tier logic shared by client and server. React building blocks live on `./client`; server-only
// code lives on `./server`.
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
