// Server-only entry for `@lunaris/easypoints-hydrogen/server`.
//
// This module holds the easyPoints API token and talks to the loyalty API from within
// Hydrogen loaders/actions. It must NEVER be bundled into the browser. The guard below
// fails loudly if it is imported in a client context (workerd/SSR has no `window`).
if (typeof window !== "undefined") {
  throw new Error(
    "@lunaris/easypoints-hydrogen/server is server-only and must not be imported in the browser.",
  );
}

// Loyalty client factory + its public types.
export { createEasyPointsClient } from "./server/loyalty";
export type { Context, CreateEasyPointsClientParams, EasyPointsClient } from "./server/loyalty";

// Customer loyalty query.
export { queryCustomerLoyalty } from "./server/loyalty-customer";

// Shop + product points math.
export { fetchShopLoyalty } from "./server/shop";
export { productPoints } from "./server/product";

// Cart points action dispatcher. `CalculatePointsResponse` + the route-path const are
// consumed type-only by the client hooks.
export {
  ACTIONS,
  CART_POINTS_ROUTE_PATH,
  createCartPointsAction,
} from "./server/routes/cartPoints";
export type { CalculatePointsResponse } from "./server/routes/cartPoints";

// Errors.
export { ContextError, LoyaltyClientError } from "./server/errors";

// GraphQL queries + fragments (merchants embed the fragments in their own codegen).
export {
  COLLECTION_LOYALTY_METAFIELD_FRAGMENT,
  COLLECTIONS_LOYALTY_FRAGMENT,
  CUSTOMER_LOYALTY_METAFIELD_FRAGMENT,
  CUSTOMER_LOYALTY_QUERY,
  PRODUCT_LOYALTY_QUERY,
  SHOP_LOYALTY_QUERY,
} from "./server/graphql";
