# easypoints-hydrogen

Monorepo for [`@teamlunaris/easypoints-hydrogen`](./packages/easypoints-hydrogen) — a React +
TypeScript library that integrates the [easyPoints](https://www.easypoints.jp/) loyalty program
into [Shopify Hydrogen](https://shopify.dev/docs/storefronts/headless/hydrogen) storefronts.

It provides:

- a **server-side loyalty client** for Hydrogen loaders/actions (holds the easyPoints API token),
- **TypeScript types** for loyalty data, exported to consumers,
- **headless (unstyled) React building blocks** to surface loyalty data to customers.

> **Status:** scaffolding only. The package currently exposes stub entry points; the loyalty
> client, types, and components are ported in a follow-up phase.

## Layout

| Path                           | Description                                                             |
| ------------------------------ | ----------------------------------------------------------------------- |
| `packages/easypoints-hydrogen` | The publishable library.                                                |
| `examples/storefront`          | A minimal Hydrogen app that consumes the library for local development. |

## Toolchain

This repo uses **[Vite+](https://viteplus.dev/) (`vp`)** as its sole toolchain and **pnpm**
workspaces.

```sh
corepack enable pnpm          # use the pinned pnpm
pnpm install                  # install + link the workspace
vp run build                  # build every package (`vp pack` per package)
vp run check                  # lint + format + typecheck (Oxlint + Oxfmt + tsc)
vp run test                   # run tests (Vitest)
```

Install Vite+ once on your machine:

```sh
curl -fsSL https://vite.plus | bash
```
