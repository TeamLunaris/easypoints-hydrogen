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
// The server entry is imported dynamically *inside* the action: route modules are lazy-loaded in
// the client, and a module-scope import of `@teamlunaris/easypoints-hydrogen/server` would trip its
// server-only guard in the browser before the action ever runs on the server.
export async function action(args: Route.ActionArgs) {
  const {createCartPointsAction} = await import('@teamlunaris/easypoints-hydrogen/server');
  const handleAction = createCartPointsAction();
  return handleAction<Route.ActionArgs>(args);
}
