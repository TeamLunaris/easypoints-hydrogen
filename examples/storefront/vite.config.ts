import { defineConfig } from "vite-plus";

// Minimal example consumer. Full Hydrogen setup (server entry, @shopify/hydrogen Vite
// plugin, routes) is added when fleshing this out into a real storefront — see README.
//
// `resolve.dedupe` is belt-and-suspenders alongside the root .npmrc hoist patterns: it
// guarantees the linked library and this app share one copy of React / React Router.
export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom", "react-router"],
  },
  // Make `vp check` type-check this app too (via tsgolint / TypeScript-Go).
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
