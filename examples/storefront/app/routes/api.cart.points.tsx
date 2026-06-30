import type {Route} from './+types/api.cart.points';

// Keep these route action ids local and browser-safe. Route modules are lazy-loaded in the client,
// so importing `@lunaris/easypoints-hydrogen/server` at module scope crashes with the server-only
// guard before the action can run on the server.
export const CART_POINTS_ACTIONS = {
  CALCULATE_POINTS: 'CalculatePoints',
  REDEEM_POINTS: 'RedeemPoints',
  UNDO_REDEEM: 'UndoRedeem',
} as const;

export type CalculatePointsResponse = {
  pointsMap: Record<string, number | null>;
} | null;

// Mounted at `/api/cart/points` (matches the library's `CART_POINTS_ROUTE_PATH` default).
// Dispatches the CalculatePoints / RedeemPoints / UndoRedeem actions against `context.cart`
// + `context.loyalty`. Pass a `lineFilter` here to exclude lines that shouldn't earn points.
export async function action(args: Route.ActionArgs) {
  const {createCartPointsAction} = await import('@lunaris/easypoints-hydrogen/server');
  const handleAction = createCartPointsAction();
  return handleAction<Route.ActionArgs>(args);
}
