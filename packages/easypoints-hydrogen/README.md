# @lunaris/easypoints-hydrogen

Headless React building blocks and a server-side client to integrate the
[easyPoints](https://www.easypoints.jp/) loyalty program into
[Shopify Hydrogen](https://shopify.dev/docs/storefronts/headless/hydrogen) storefronts.

> **Status:** scaffolding only. Entry points are wired and the package builds, but the
> loyalty client, domain types, and components are stubs ported in a follow-up phase.

## Install

```sh
pnpm add @lunaris/easypoints-hydrogen
```

Peer dependencies (provided by your Hydrogen app): `@shopify/hydrogen`, `react`,
`react-router` (and `react-dom` if your usage needs it).

## Entry points

| Import                                | Environment   | Contents                                                                |
| ------------------------------------- | ------------- | ----------------------------------------------------------------------- |
| `@lunaris/easypoints-hydrogen`        | browser + SSR | React provider, hooks, headless components, isomorphic utilities        |
| `@lunaris/easypoints-hydrogen/server` | server only   | loyalty client (holds the API token), route handlers, GraphQL fragments |
| `@lunaris/easypoints-hydrogen/types`  | types only    | TypeScript types for loyalty data                                       |

The `/server` entry is server-only and throws if imported in the browser. Configure it with
`EASY_POINTS_API_TOKEN` (and optionally `EASY_POINTS_API_ENDPOINT`) from your Hydrogen
`context.env`.

## Develop

From the workspace root: `pnpm install`, then `vp run build` / `vp run check` / `vp run test`.
