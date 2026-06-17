import { defineConfig } from "vite-plus";

// Library build is driven by Vite+ `vp pack` (tsdown under the hood):
// emits ESM + per-entry .d.ts that line up 1:1 with the package.json "exports" map.
// tsdown auto-externalizes dependencies + peerDependencies (react, react-dom,
// react-router, @shopify/hydrogen), so no manual `external` list is needed.
export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/server.ts", "src/types.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    minify: false,
  },
  // Make `vp check` the single static-check command: type-aware lint + type checking
  // (run via tsgolint / TypeScript-Go), on top of Oxlint + Oxfmt.
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
