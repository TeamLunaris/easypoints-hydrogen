// Client (browser-safe) entry for `@lunaris/easypoints-hydrogen`.
//
// Re-exports the headless React building blocks, hooks, optional provider, and isomorphic
// utilities. Ported in the follow-up phase from solaris-cards-storefront
// (app/components/points/, app/hooks/useCartPoints.ts, app/lib/easy-points/tiers.ts).
//
// INVARIANT: this entry must never import from "./server" — keeps the API token and any
// server-only code out of the browser bundle.

export const VERSION = "0.1.0";

export type * from "./types";
