# CLAUDE.md

`@lunaris/easypoints-hydrogen`: headless React building blocks plus a server-side
client that integrates the easyPoints loyalty program into Shopify Hydrogen storefronts.

## Architecture facts

- Auth is **Bearer token** (`env.EASY_POINTS_API_TOKEN`), NOT Basic Auth.
- Base `env.EASY_POINTS_API_ENDPOINT` (default `https://loyalty.slrs.io/api`),
  header `x-api-version: 2.0.0`.
- Server client is a factory mounted as `context.loyalty`. Customer loyalty comes
  from Shopify metafields via GraphQL; REST handles coupons + points calc.
- Components are HEADLESS/unstyled.
- **Valibot** validates external JSON at the trust boundary AND is the source of truth
  for its types.

## Toolchain: Vite+ (`vp`) only

pnpm workspace driven entirely by Vite+. Do NOT add eslint, prettier,
vite-plugin-dts, vitest, or any `@teamlunaris/*` shared config.

- `pnpm exec vp pack` builds the library (tsdown). Emits `.mjs` + `.d.mts`, so the
  `exports` map points at `./dist/<name>.mjs` / `.d.mts`.
- `pnpm exec vp check` is the single static-check command: Oxlint + Oxfmt +
  type-aware checking (tsgolint / TypeScript-Go, not `tsc`). `--fix` applies formatting.
- `pnpm exec vp test` runs Vitest. In tests import from `vite-plus/test` (no standalone
  `vitest` package). Avoid explicit `.ts` import extensions.
- Root scripts fan out with `vp run -r <task>`; bare `vp run <task>` does not.
- `vite.config.ts` must `import { defineConfig } from "vite-plus"` (no separate `vite`).

## Layout

- `packages/easypoints-hydrogen` is the publishable lib.
  Entries: `index.ts` (isomorphic, browser-safe: types + `keysToCamel` + tier logic),
  `client.ts` (React hooks + provider, browser-safe), `server.ts` (holds token, server-only),
  `types.ts`. INVARIANT: neither `index.ts` nor `client.ts` may import from `./server`.
- `examples/storefront` is a minimal Hydrogen consumer for local dev.

## Targets

Hydrogen 2026.x, React Router 7.12+, React 19. Node >=20.
