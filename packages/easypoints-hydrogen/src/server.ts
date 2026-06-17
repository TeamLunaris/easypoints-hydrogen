// Server-only entry for `@lunaris/easypoints-hydrogen/server`.
//
// This module holds the easyPoints API token and talks to the loyalty API from within
// Hydrogen loaders/actions. It must NEVER be bundled into the browser. The guard below
// fails loudly if it is imported in a client context (workerd/SSR has no `window`).
if (typeof window !== "undefined") {
  throw new Error(
    "@lunaris/easypoints-hydrogen/server is server-only and must not be imported in the browser.",
  );
}

// Placeholder factory — the real Bearer-token loyalty client, route handlers, and GraphQL
// fragments are ported in the follow-up phase from solaris-cards-storefront
// (app/lib/easy-points/loyalty.server.ts, api/client.ts, routes/, shopify-gql/).
//
// TODO(follow-up plan): implement createEasyPointsClient.
export function createEasyPointsClient(): never {
  throw new Error("not implemented");
}
