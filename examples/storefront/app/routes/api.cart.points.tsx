import {createCartPointsAction} from '@lunaris/easypoints-hydrogen/server';
import type {Route} from './+types/api.cart.points';

// Re-export the action's response type + action constants so client code (e.g. the
// `useCartPoints` / `usePointsRedemption` hooks) stays in sync with this route.
export {ACTIONS as CART_POINTS_ACTIONS} from '@lunaris/easypoints-hydrogen/server';
export type {CalculatePointsResponse} from '@lunaris/easypoints-hydrogen/server';

// Mounted at `/api/cart/points` (matches the library's `CART_POINTS_ROUTE_PATH` default).
// Dispatches the CalculatePoints / RedeemPoints / UndoRedeem actions against `context.cart`
// + `context.loyalty`. Pass a `lineFilter` here to exclude lines that shouldn't earn points.
const handleAction = createCartPointsAction();

export async function action(args: Route.ActionArgs) {
  return handleAction<Route.ActionArgs>(args);
}
