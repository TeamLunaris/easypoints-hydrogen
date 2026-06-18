# Design decisions / open questions

Running log of design rationale we want to remember (and revisit). Each entry: the decision, why,
and any open question to come back to.

---

## `useCustomerLoyalty` — explicit arg vs. provider fallback

**Status:** decided (keep as-is) · open follow-up noted below.

### What it does

```ts
useCustomerLoyalty()       // undefined → defer to the EasyPointsProvider
useCustomerLoyalty(null)   // null      → force "no loyalty", ignore the provider
useCustomerLoyalty(value)  // value     → use it
```

The `loyalty !== undefined` check (not `??`) is deliberate: an explicit `null` means "I *know*
there's no customer" (signed-out) rather than silently falling through to the provider.

### Why

This is the arg-or-provider convention the D5 spec mandates for **every** hook ("Hooks take
explicit args and fall back to the provider"). Two legitimate ways a storefront has the data:

- **Explicit arg** — a component already holds the metafield (its own route loader / props) and
  passes it: `useCustomerLoyalty(loyalty)`. No provider required. This mirrors the source, where
  `CustomerLoyaltySection` received `customerLoyalty` as a prop straight from the loader.
- **Provider fallback** — the storefront resolves loyalty once in a root loader, drops it into
  `<EasyPointsProvider customerLoyalty={…}>`, and deeply nested headless components call
  `useCustomerLoyalty()` with no args, avoiding prop-drilling. (The provider is a D5 addition for
  exactly this.)

The hook is thin (one line). Its value is being the **single place** the arg-vs-provider rule
lives, and giving consumers / D6 components a stable named accessor instead of reaching into
`useEasyPointsConfig()` directly.

### Open follow-up

The other three hooks don't currently route through `useCustomerLoyalty`:
- `usePointsRedemption` reads `config.customerLoyalty?.balance` directly.
- `useTierProgress` builds `{ loyalty: config.customerLoyalty }` itself.

So today `useCustomerLoyalty` is really for consumer/component use, not internal reuse. Options if
we revisit:
1. Route those two through `useCustomerLoyalty` so the resolution logic is genuinely centralized.
2. Drop the hook and let consumers read the provider directly.

Left as-is for now to match the spec's "four hooks" surface.
