// Client (browser/React) entry for `@lunaris/easypoints-hydrogen/client`.
//
// The headless React building blocks: hooks plus the optional context provider. Consumers import
// these in browser/SSR React code; the isomorphic helpers (types, `keysToCamel`, tier logic) live
// on the root entry, and server-only code lives on `./server`.
//
// Browser-safe: route/action constants + response types are coupled to the server route by
// type only, so no server code reaches this bundle. This entry must never import from "./server".

// Shared client error types.
export { MissingContextError } from "./client/errors";

// Optional context provider. The four client hooks read explicit args first and fall back to it.
export { EasyPointsProvider } from "./client/context";
export type { EasyPointsContext, EasyPointsProviderProps } from "./client/context";

// Client hooks.
export { useCustomerLoyalty } from "./client/hooks/useCustomerLoyalty";
export { useCartPoints } from "./client/hooks/useCartPoints";
export type {
  PointsCart,
  PointsCartLine,
  UseCartPointsOptions,
} from "./client/hooks/useCartPoints";
export { FETCHER_REDEMPTION_KEY, usePointsRedemption } from "./client/hooks/usePointsRedemption";
export type { UsePointsRedemptionParams } from "./client/hooks/usePointsRedemption";
export { BASE_TIER_PROGRESS_PERCENTAGE, useTierProgress } from "./client/hooks/useTierProgress";
