# @examples/storefront

A minimal consumer of [`@lunaris/easypoints-hydrogen`](../../packages/easypoints-hydrogen) used
for local development of the library.

At the scaffolding stage this is a smoke-test consumer: it imports the library across the pnpm
workspace link (proving single-React resolution) and logs the version. There is no full Hydrogen
runtime yet.

## Turning this into a real Hydrogen storefront

Run the Hydrogen scaffolder and merge its output into this directory (it is interactive):

```sh
pnpm create @shopify/hydrogen@latest
```

Then keep the `@lunaris/easypoints-hydrogen` dependency at `workspace:*` and the
`resolve.dedupe` setting in `vite.config.ts`, and mount the loyalty client into
`context` following the pattern in `solaris-cards-storefront/app/lib/context.ts`.
