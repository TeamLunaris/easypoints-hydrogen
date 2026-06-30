// Browser-safe contract for the cart-points resource route.
//
// Plain string constants + response types shared across the trust boundary: the server `action`
// dispatcher (`server/routes/cartPoints.ts`), the client hooks (`useCartPoints` /
// `useCartRedemption`), and the merchant's own route module all import from here. It holds no
// secrets and no server-only code, so it ships safely in the browser bundle via the root entry —
// keeping a single source of truth instead of each side pinning its own copy.

/** Default path the merchant should mount the resource route at. */
export const CART_POINTS_ROUTE_PATH = "/api/cart/points";

/** The `action` form-field values the dispatcher switches on. */
export const CART_POINTS_ACTIONS = {
  CALCULATE_POINTS: "CalculatePoints",
  REDEEM_POINTS: "RedeemPoints",
  UNDO_REDEEM: "UndoRedeem",
} as const;

/** Structured error returned by the redeem action (replaces the source's `t::` strings). */
export interface PointsActionError {
  code?: string;
  message: string;
}

/**
 * Response for the `CALCULATE_POINTS` action: line id → points (or `null` when uncomputable).
 * Always a present object — an absent or empty cart yields an empty `pointsMap`, never `null`.
 */
export type CalculatePointsResponse = {
  pointsMap: Record<string, number | null>;
};

/** Response for the `REDEEM_POINTS` action. */
export interface RedeemPointsResponse {
  success: boolean;
  points: number;
  error?: PointsActionError;
}
