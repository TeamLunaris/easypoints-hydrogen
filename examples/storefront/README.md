# @examples/storefront

A minimal **real Hydrogen** storefront (scaffolded with `pnpm create @shopify/hydrogen@latest`,
Mock.shop data) that consumes [`@lunaris/easypoints-hydrogen`](../../packages/easypoints-hydrogen)
end-to-end. It exists to prove the library is consumable by a real merchant and for local dev.

## easyPoints wiring

| Concern | File |
| --- | --- |
| Mount `createEasyPointsClient` as `context.loyalty` + `.init(...)` | [`app/lib/context.ts`](./app/lib/context.ts) |
| Cart-points resource route (`createCartPointsAction()`) at `/api/cart/points` | [`app/routes/api.cart.points.tsx`](./app/routes/api.cart.points.tsx) |
| Embed the `CustomerLoyaltyMetafield` fragment in the customer query | [`app/graphql/customer-account/CustomerDetailsQuery.ts`](./app/graphql/customer-account/CustomerDetailsQuery.ts) |
| `EasyPointsProvider` (shared config) | [`app/root.tsx`](./app/root.tsx) |
| `<ProductPoints>` (server-side points calc) | [`app/routes/products.$handle.tsx`](./app/routes/products.$handle.tsx) |
| `<CustomerLoyalty>` + `<TierProgress>` | [`app/routes/account._index.tsx`](./app/routes/account._index.tsx) |
| `useCartPoints` + `<PointsRedemption>` | [`app/routes/cart.tsx`](./app/routes/cart.tsx) |

## Environment

The merchant supplies easyPoints credentials via env vars (see [`.env.example`](./.env.example)),
read in `app/lib/context.ts`:

- `EASY_POINTS_API_TOKEN` — Bearer token (requests are unauthenticated without it).
- `EASY_POINTS_API_ENDPOINT` — optional base override (default `https://loyalty.slrs.io/api`).

## Scripts

```sh
pnpm --filter @examples/storefront dev      # shopify hydrogen dev (MiniOxygen)
pnpm --filter @examples/storefront build    # shopify hydrogen build
pnpm --filter @examples/storefront check    # react-router typegen && tsc --noEmit
```

Typecheck and build work without a live store/token (Mock.shop + the loyalty calls degrade to
"no points"). A full live smoke needs a real Shopify store + easyPoints token.

> This example keeps the standard Hydrogen toolchain (`@shopify/cli` + the Hydrogen/Oxygen Vite
> plugins) rather than the workspace's Vite+ (`vp`) — a real merchant app builds the way Shopify
> ships it. The library package still builds/lints with `vp`.
