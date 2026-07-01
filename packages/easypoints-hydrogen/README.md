# @teamlunaris/easypoints-hydrogen

[![npm](https://img.shields.io/npm/v/@teamlunaris/easypoints-hydrogen?logo=npm&label=npm)](https://www.npmjs.com/package/@teamlunaris/easypoints-hydrogen)
[![GitHub Packages](https://img.shields.io/github/v/tag/TeamLunaris/easypoints-hydrogen?logo=github&label=GitHub%20Packages)](https://github.com/TeamLunaris/easypoints-hydrogen/pkgs/npm/easypoints-hydrogen)
[![JSR](https://jsr.io/badges/@teamlunaris/easypoints-hydrogen)](https://jsr.io/@teamlunaris/easypoints-hydrogen)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0--only-blue.svg)](./LICENSE)

Headless React building blocks and a server-side client that integrate the
[easyPoints](https://www.easypoints.jp/) loyalty program into
[Shopify Hydrogen](https://hydrogen.shopify.dev/) storefronts.

- **Server loyalty client**: holds the API token, runs in Hydrogen loaders/actions, talks to the
  easyPoints REST API and reads loyalty data from Shopify metafields.
- **React hooks + provider**: cart points, redemption, tier progress, customer loyalty.
- **Headless (unstyled) components**: render-prop building blocks; you own all markup and styles.
- **TypeScript types**: validated at the trust boundary with [Valibot](https://valibot.dev/) and
  exported for consumers.

## Install

Use whichever package manager your Hydrogen app uses:

```sh
npm install @teamlunaris/easypoints-hydrogen
```

```sh
pnpm add @teamlunaris/easypoints-hydrogen
```

Peer dependencies, provided by your Hydrogen app: `@shopify/hydrogen`, `react`, `react-router`
(and `react-dom` if your usage needs it).

**Requirements:** Hydrogen 2026.x · React Router 7.12+ · React 19 · Node ≥ 22.13.

## Entry points

The package splits along the browser/server trust boundary. Respect it:

| Import                                    | Environment     | Contents                                                                                                              |
| ----------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `@teamlunaris/easypoints-hydrogen`        | browser + SSR   | isomorphic: domain types, tier logic, and the headless render-prop components                                         |
| `@teamlunaris/easypoints-hydrogen/client` | browser + SSR   | React hooks (`useCartPoints`, `useCartRedemption`, `useTierProgress`, `useCustomerLoyalty`) + `EasyPointsProvider`    |
| `@teamlunaris/easypoints-hydrogen/server` | **server only** | loyalty client (`createEasyPointsClient`), cart-points route action, product/customer/shop queries, GraphQL fragments |
| `@teamlunaris/easypoints-hydrogen/types`  | types only      | TypeScript types for loyalty data                                                                                     |

> The `/server` entry holds `EASY_POINTS_API_TOKEN` and **throws if imported in the browser**.
> Never import it from client code. The root and `/client` entries are safe everywhere.

## Quickstart

The wiring is four steps. See [the getting-started guide](https://github.com/TeamLunaris/easypoints-hydrogen/blob/main/docs/getting-started.md) for the full
walkthrough and [`examples/storefront`](https://github.com/TeamLunaris/easypoints-hydrogen/tree/main/examples/storefront) for a complete working app.

**1. Mount the client on the Hydrogen context** (`app/lib/context.ts`), then `init()` it:

```ts
import { createEasyPointsClient } from "@teamlunaris/easypoints-hydrogen/server";

const loyalty = createEasyPointsClient({
  cache,
  waitUntil,
  request,
  token: env.EASY_POINTS_API_TOKEN ?? "",
  endpoint: env.EASY_POINTS_API_ENDPOINT, // optional, defaults to https://loyalty.slrs.io/api
});

// after createHydrogenContext(...):
hydrogenContext.loyalty.init(hydrogenContext); // bind storefront + customer-account handles
```

**2. Add the cart-points resource route** at `/api/cart/points` (`app/routes/api.cart.points.tsx`).
Import `/server` dynamically inside the action so its server-only guard isn't tripped when the route
module is lazy-loaded in the browser:

```ts
import type { Route } from "./+types/api.cart.points";

export async function action(args: Route.ActionArgs) {
  const { createCartPointsAction } = await import("@teamlunaris/easypoints-hydrogen/server");

  const handleAction = createCartPointsAction(); // optional `lineFilter` to exclude cart lines
  return handleAction<Route.ActionArgs>(args);
}
```

**3. Wrap your app in the provider** (`app/root.tsx`) to share currency + route config:

```tsx
import { EasyPointsProvider } from "@teamlunaris/easypoints-hydrogen/client";

<EasyPointsProvider currencyCode="USD">{/* app */}</EasyPointsProvider>;
```

**4. Render headless components / use hooks.** All components are unstyled and expose data via
render props; the markup is yours:

```tsx
import { CustomerLoyalty, TierProgress, CartRedemption } from "@teamlunaris/easypoints-hydrogen";
import { useCartPoints } from "@teamlunaris/easypoints-hydrogen/client";

<CustomerLoyalty loyalty={loyalty}>
  {({ balance, tier }) => (
    <p>
      {balance} pts · {tier?.name}
    </p>
  )}
</CustomerLoyalty>;

const { totalPoints } = useCartPoints(cart);
```

## Documentation

- **[Getting started](https://github.com/TeamLunaris/easypoints-hydrogen/blob/main/docs/getting-started.md)**: step-by-step Hydrogen integration.
- **[`examples/storefront`](https://github.com/TeamLunaris/easypoints-hydrogen/tree/main/examples/storefront)**: a complete Hydrogen app using every entry point.
- **API reference**: published to [JSR](https://jsr.io/@teamlunaris/easypoints-hydrogen), generated
  from the source doc comments.

## License

[GPL-3.0-only](./LICENSE)
