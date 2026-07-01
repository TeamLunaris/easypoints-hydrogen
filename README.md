# easypoints-hydrogen

Monorepo for [`@teamlunaris/easypoints-hydrogen`](./packages/easypoints-hydrogen), a React +
TypeScript library that integrates the [easyPoints](https://www.easypoints.jp/) loyalty program
into [Shopify Hydrogen](https://shopify.dev/docs/storefronts/headless/hydrogen) storefronts.

It provides:

- a **server-side loyalty client** for Hydrogen loaders/actions (holds the easyPoints API token),
- **TypeScript types** for loyalty data, exported to consumers,
- **headless (unstyled) React building blocks** to surface loyalty data to customers.

## Usage

See the package [`README`](./packages/easypoints-hydrogen/README.md) for install + a quickstart, the
[getting-started guide](./docs/getting-started.md) for a step-by-step Hydrogen integration, and
[`examples/storefront`](./examples/storefront) for a complete working consumer.

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
vp run check                  # lint + format + type-aware checks (Oxlint + Oxfmt + tsgolint)
vp run test                   # run tests (Vitest)
```
