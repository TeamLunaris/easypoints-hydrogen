# Integrating easyPoints into a Hydrogen storefront

A step-by-step guide to wiring [`@lunaris/easypoints-hydrogen`](../packages/easypoints-hydrogen)
into a Shopify Hydrogen app. For the per-file changelog of what changed in `examples/storefront`
when this example was built, see
[`examples/storefront/CHANGELOG.md`](../examples/storefront/CHANGELOG.md).

The example is a stock Hydrogen skeleton (scaffolded with `pnpm create @shopify/hydrogen@latest`,
Mock.shop data). Everything below is *additive* to that skeleton — these are the only touch points
the loyalty integration needs.

---

## Integration guide

The library splits into three import entries; respect the boundary:

| Entry | Use from | Holds the token? |
| --- | --- | --- |
| `@lunaris/easypoints-hydrogen/server` | loaders, actions, `context.ts` | **Yes — server only** |
| `@lunaris/easypoints-hydrogen/client` | hooks + provider (browser) | No |
| `@lunaris/easypoints-hydrogen` | isomorphic types, components, `keysToCamel` | No |

Never import `/server` from browser code — the entry guards against it, and it carries
`EASY_POINTS_API_TOKEN`.

### 1. Mount the loyalty client on the Hydrogen context

In `app/lib/context.ts`, construct the client and add it to the additional-context object, then
call `.init(hydrogenContext)` so it can reach the storefront + customer-account handles.

```ts
import {createEasyPointsClient, type EasyPointsClient} from '@lunaris/easypoints-hydrogen/server';

interface LoyaltyContext {
  loyalty: EasyPointsClient;
}

declare global {
  interface HydrogenAdditionalContext extends LoyaltyContext {}
  interface Env {
    EASY_POINTS_API_TOKEN?: string;
    EASY_POINTS_API_ENDPOINT?: string;
  }
}

const additionalContext: LoyaltyContext = {
  loyalty: createEasyPointsClient({
    cache,
    waitUntil,
    request,
    token: env.EASY_POINTS_API_TOKEN ?? '',
    endpoint: env.EASY_POINTS_API_ENDPOINT, // optional
  }),
};

const hydrogenContext = createHydrogenContext({ /* …env, request, cache, session, cart… */ }, additionalContext);
hydrogenContext.loyalty.init(hydrogenContext); // bind storefront/customer handles
return hydrogenContext;
```

Loaders/actions then read `context.loyalty`.

### 2. Add the cart-points resource route

Create `app/routes/api.cart.points.tsx` — the filename **must** map to `/api/cart/points`, the
library's `CART_POINTS_ROUTE_PATH` default. It dispatches CalculatePoints / RedeemPoints /
UndoRedeem against `context.cart` + `context.loyalty`.

```ts
import {createCartPointsAction} from '@lunaris/easypoints-hydrogen/server';
import type {Route} from './+types/api.cart.points';

export {ACTIONS as CART_POINTS_ACTIONS} from '@lunaris/easypoints-hydrogen/server';
export type {CalculatePointsResponse} from '@lunaris/easypoints-hydrogen/server';

const handleAction = createCartPointsAction(); // pass a `lineFilter` to exclude lines

export async function action(args: Route.ActionArgs) {
  return handleAction<Route.ActionArgs>(args);
}
```

### 3. Embed the customer loyalty fragment

The library ships `CUSTOMER_LOYALTY_METAFIELD_FRAGMENT` as the source of truth, but the **string
must be embedded in a file the merchant's GraphQL codegen scans** (the
`app/graphql/customer-account/*` glob) so `customer.loyalty` lands in the generated types. Add the
fragment to `CustomerDetailsQuery.ts` and spread it into the `Customer` fragment:

```graphql
fragment CustomerLoyaltyMetafield on Customer {
  loyalty: metafield(namespace: "loyalty", key: "easy_points_attributes") {
    value
    type
  }
}
```

At load time, parse the raw JSON and camelCase it before handing to components:

```ts
import {keysToCamel, type CustomerLoyaltyMetafield} from '@lunaris/easypoints-hydrogen';

const raw = data.customer.loyalty?.value;
const loyalty = raw ? keysToCamel<CustomerLoyaltyMetafield>(JSON.parse(raw)) : null;
```

### 4. Wrap the app in the provider

In `app/root.tsx`, wrap the tree in `<EasyPointsProvider>` to share display config (currency +
cart-points route) with the hooks/components. Optional — every hook also accepts the values
explicitly.

```tsx
import {EasyPointsProvider} from '@lunaris/easypoints-hydrogen/client';
// …
<EasyPointsProvider currencyCode="USD">{/* app */}</EasyPointsProvider>
```

### 5. Render the headless components

All components are unstyled — they expose data via render props; the markup is yours.

| Where | Imports | What it shows |
| --- | --- | --- |
| `products.$handle.tsx` | `ProductPoints` (isomorphic), `productPoints` (`/server`) | points earned per product (server-calculated; `null` → "no points") |
| `account._index.tsx` | `CustomerLoyalty`, `TierProgress` | balance + current tier, progress to next tier |
| `cart.tsx` | `useCartPoints` (`/client`), `CartRedemption` (isomorphic) | live cart points total + redeem/undo flow |

Product points (server side, in the loader):

```ts
import {productPoints} from '@lunaris/easypoints-hydrogen/server';
const points = await productPoints(context.loyalty, {handle, selectedOptions});
```

Cart points + redemption (client side):

```tsx
const {totalPoints} = useCartPoints(useOptimisticCart(cart));
// <CartRedemption pointsBalance={accountPoints?.balance ?? null} isOptimistic={…}>
//   {({input, form, result}) => …}  // input.{value,setValue,step}, form.{submit,undo,isValid,isSubmitting}, result.{redeemedPoints,error}
```

Cart loyalty is loaded with `await context.loyalty.getCustomerLoyalty()` (returns `null` when
signed out, so the cart still renders for anonymous shoppers).

### 6. Environment

```sh
EASY_POINTS_API_TOKEN=          # Bearer token; requests are unauthenticated without it
EASY_POINTS_API_ENDPOINT=       # optional, default https://loyalty.slrs.io/api
```

Read once in `context.ts`. Typecheck + build work without a token — the loyalty calls degrade to
"no points". A full live smoke needs a real Shopify store + token.
