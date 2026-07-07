import {createCartPointsAction} from '@teamlunaris/easypoints-hydrogen/server';

import type {Route} from './+types/api.cart.points';

// The route contract (action ids + response type) is browser-safe, so it comes from the root
// entry — re-exporting it here keeps it colocated with the route for consumers of this module.
export {CART_POINTS_ACTIONS} from '@teamlunaris/easypoints-hydrogen';
export type {CalculatePointsResponse} from '@teamlunaris/easypoints-hydrogen';

// Mounted at `/api/cart/points` (matches the library's `CART_POINTS_ROUTE_PATH` default).
// Dispatches the CalculatePoints / RedeemPoints / UndoRedeem actions against `context.cart`
// + `context.loyalty`. Pass a `lineFilter` to `createCartPointsAction` to exclude lines that
// shouldn't earn points.
//
// `/server` is imported at module scope. React Router's automatic code splitting strips server-only
// route exports (`action`/`loader`) — and their now-unused imports — from the client bundle, so the
// server entry never reaches the browser and its server-only guard never runs there.
export async function action(args: Route.ActionArgs) {
  const handleAction = createCartPointsAction();
  return handleAction<Route.ActionArgs>(args);
}
