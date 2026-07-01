# AGENTS.md: using `@teamlunaris/easypoints-hydrogen`

Guidance for AI coding assistants writing code **in a Shopify Hydrogen storefront that consumes this
library**. (This is not a guide for modifying the library itself.) Follow it to wire easyPoints
loyalty correctly on the first try.

## What this package is

Headless building blocks + a server-side client that add the [easyPoints](https://www.easypoints.jp/)
loyalty program to a Hydrogen storefront. It computes points earned per product, shows tier
progress, and drives cart redemption. Components are **headless (unstyled)**: they expose data via
render props and the consumer supplies all markup.

**Targets:** Hydrogen 2026.x · React Router 7.12+ · React 19 · Node ≥ 22.13.

## The one rule that matters: the trust boundary

There are four entry points. Import from the right one:

| Import                                    | Safe in browser?   | Use it for                                    |
| ----------------------------------------- | ------------------ | --------------------------------------------- |
| `@teamlunaris/easypoints-hydrogen`        | ✅                 | domain types, tier logic, headless components |
| `@teamlunaris/easypoints-hydrogen/client` | ✅                 | React hooks + `EasyPointsProvider`            |
| `@teamlunaris/easypoints-hydrogen/server` | ❌ **server only** | loyalty client, route action, GraphQL queries |
| `@teamlunaris/easypoints-hydrogen/types`  | ✅ (types only)    | TypeScript types                              |

**Never import `/server` from client/browser code.** It holds `EASY_POINTS_API_TOKEN` and throws at
runtime if it reaches a browser context. Only import it from loaders, actions, and `app/lib/context.ts`.

## Configuration

Set in the Hydrogen environment (`context.env`):

- `EASY_POINTS_API_TOKEN`: **Bearer** token for the easyPoints API (not Basic Auth). Requests are
  unauthenticated without it; local dev still boots (calls degrade to "no points").
- `EASY_POINTS_API_ENDPOINT`: optional; defaults to `https://loyalty.slrs.io/api`.

## The canonical wiring recipe

1. **Mount the client** in `app/lib/context.ts` and `init()` it:

   ```ts
   import { createEasyPointsClient } from "@teamlunaris/easypoints-hydrogen/server";

   const loyalty = createEasyPointsClient({
     cache,
     waitUntil,
     request,
     token: env.EASY_POINTS_API_TOKEN ?? "",
     endpoint: env.EASY_POINTS_API_ENDPOINT,
   });

   // add `loyalty` to the additional-context object passed to createHydrogenContext(...), then:
   hydrogenContext.loyalty.init(hydrogenContext);
   ```

   Loaders/actions then read `context.loyalty`.

2. **Add the cart-points resource route** at `app/routes/api.cart.points.tsx`. The filename **must**
   map to `/api/cart/points` (the `CART_POINTS_ROUTE_PATH` default the hooks post to). Import
   `/server` **dynamically inside the action** — a module-scope import would trip its server-only
   guard when the route module is lazy-loaded in the browser:

   ```ts
   import type { Route } from "./+types/api.cart.points";

   export async function action(args: Route.ActionArgs) {
     const { createCartPointsAction } = await import(
       "@teamlunaris/easypoints-hydrogen/server"
     );

     const handleAction = createCartPointsAction(); // optional `lineFilter` to exclude lines
     return handleAction<Route.ActionArgs>(args);
   }
   ```

3. **Embed the customer loyalty GraphQL fragment** where the merchant's codegen scans it (the
   `app/graphql/customer-account/*` glob), so `customer.loyalty` lands in generated types. The
   library exports `CUSTOMER_LOYALTY_METAFIELD_FRAGMENT` as the source of truth. Parse + camelCase
   the raw metafield JSON before handing it to components:

   ```ts
   import { keysToCamel, type CustomerLoyaltyMetafield } from "@teamlunaris/easypoints-hydrogen";
   const raw = data.customer.loyalty?.value;
   const loyalty = raw ? keysToCamel<CustomerLoyaltyMetafield>(JSON.parse(raw)) : null;
   ```

4. **Wrap the app** in `app/root.tsx` with `<EasyPointsProvider currencyCode="USD">`. Optional:
   every hook also accepts its inputs explicitly.

5. **Render data.** Server-side, compute product points in the loader with
   `productPoints(context.loyalty, { handle, selectedOptions })`. Client-side, use the hooks /
   headless components.

## API surface (what to reach for)

- **Server** (`/server`): `createEasyPointsClient`, `createCartPointsAction`, `productPoints`,
  `queryCustomerLoyalty`, `fetchShopLoyalty`, GraphQL constants
  (`CUSTOMER_LOYALTY_METAFIELD_FRAGMENT`, `SHOP_LOYALTY_QUERY`, `PRODUCT_LOYALTY_QUERY`, …), errors
  (`ContextError`, `CustomerNotAuthenticatedError`, `LoyaltyClientError`).
- **Client** (`/client`): `EasyPointsProvider`, `useCartPoints`, `useCartRedemption`,
  `useTierProgress`, `useCustomerLoyalty`.
- **Isomorphic** (root): components `CustomerLoyalty`, `TierProgress`, `ProductPoints`,
  `CartRedemption`; utilities `keysToCamel`, `getCurrentTier`, `getNextTier`, `getMaintenanceTier`,
  `getProgressTier`; the cart-points route contract (`CART_POINTS_ROUTE_PATH`, `CART_POINTS_ACTIONS`).

## Gotchas

- **Components are unstyled render-props.** They render no markup; pass a `children` function that
  receives the data and returns your own JSX. All accept an optional `fallback` (default `null`) for
  the no-data state.
- **Server functions return `null` on "no data" instead of throwing** (not logged in, missing
  metafield, unparseable value). Render an empty/signed-out state; don't wrap them in try/catch
  expecting errors. `getCustomerLoyalty()` returns `null` for anonymous shoppers.
- **`useCartPoints` expects the optimistic cart**: pass `useOptimisticCart(cart)` so points track
  live line changes.
- **Snake vs camel:** the library already camelCases all API and metafield data at the boundary, so
  you normally never touch this. The exported `keysToCamel` helper is only needed in the one case
  where you parse a raw metafield value yourself (see the customer loyalty fragment step).
