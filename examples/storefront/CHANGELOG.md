# Changelog — `@examples/storefront`

Integration changelog for the easyPoints wiring in this example. For the step-by-step integration
recipe, see [`docs/example-storefront-integration.md`](../../docs/example-storefront-integration.md).

## Example → real Hydrogen storefront

Replaced the plain-Vite smoke app with a real Hydrogen skeleton and layered easyPoints on top.

### Removed (old plain-Vite app)

- `index.html`, `src/main.tsx` — the old SPA entry.
- The `vite-plus` (`vp`) config in `vite.config.ts` and the `vp`-based `tsconfig` extends.

### Added — Hydrogen skeleton (not easyPoints-specific)

- `server.ts` — MiniOxygen fetch handler calling `createHydrogenRouterContext`.
- `app/` — full route tree, components, entries (`entry.client.tsx`, `entry.server.tsx`, `root.tsx`).
- `react-router.config.ts`, `.graphqlrc.ts`, `env.d.ts`, `public/`, generated
  `*.generated.d.ts` codegen output.

### Added / changed — easyPoints wiring (the integration itself)

| File | Change |
| --- | --- |
| `app/lib/context.ts` | Mount `createEasyPointsClient` as `context.loyalty`, `.init(...)`; declare `HydrogenAdditionalContext` + `Env` augmentations. |
| `app/routes/api.cart.points.tsx` | New resource route → `createCartPointsAction()` at `/api/cart/points`; re-exports `ACTIONS` + `CalculatePointsResponse`. |
| `app/graphql/customer-account/CustomerDetailsQuery.ts` | Embed `CustomerLoyaltyMetafield` fragment; spread into `Customer` fragment. |
| `app/root.tsx` | Wrap app in `<EasyPointsProvider currencyCode="USD">`. |
| `app/routes/account.tsx` | Parse loyalty metafield (`keysToCamel` + `JSON.parse`) in loader; thread via outlet context. |
| `app/routes/account._index.tsx` | Render `<CustomerLoyalty>` + `<TierProgress>`. |
| `app/routes/products.$handle.tsx` | Server-side `productPoints(context.loyalty, …)`; render `<ProductPoints>`. |
| `app/routes/cart.tsx` | Load `context.loyalty.getCustomerLoyalty()`; render `useCartPoints` + `<CartRedemption>`. |
| `.env.example` | New — `EASY_POINTS_API_TOKEN` / `EASY_POINTS_API_ENDPOINT` (+ `SESSION_SECRET`). |
| `README.md` | Rewritten as the wiring map + scripts. |

### Config / toolchain changes

- **`package.json`** — swapped to the standard Hydrogen toolchain: `@shopify/cli`,
  `@shopify/hydrogen`, `@shopify/mini-oxygen`, React Router 7.16, codegen tooling. Scripts now run
  `shopify hydrogen dev/build` + `react-router typegen && tsc`. Keeps `@lunaris/easypoints-hydrogen:
  workspace:*`.
- **`vite.config.ts`** — `vite-plus` → standard `vite` with `hydrogen()` / `oxygen()` /
  `reactRouter()` plugins. `resolve.dedupe` extended to include `@shopify/hydrogen` so the linked
  library and the app share one React / React Router / Hydrogen instance.
- **`tsconfig.json`** — replaced the `vp` extends with a self-contained Hydrogen tsconfig
  (`moduleResolution: Bundler`, Oxygen/Hydrogen/React-Router types, `~/*` path, `.react-router/types`
  rootDirs). `baseUrl: "."` with `ignoreDeprecations: "6.0"` for the codegen bare specifiers.
- **`pnpm-workspace.yaml`** (root) — `allowBuilds: workerd: true` (MiniOxygen runtime).
- **`.gitignore`** (root) — ignore `.react-router/` and `*.tsbuildinfo`.

> **Toolchain note:** the example intentionally uses the standard Hydrogen toolchain
> (`@shopify/cli` + Hydrogen/Oxygen Vite plugins), **not** the workspace's Vite+ (`vp`) — a real
> merchant app builds the way Shopify ships it. The library package still builds/lints/tests with
> `vp`.

### Verify

```sh
pnpm --filter @examples/storefront check    # react-router typegen && tsc --noEmit
pnpm --filter @examples/storefront build    # shopify hydrogen build (no store/token needed)
```
