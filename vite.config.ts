import { defineConfig } from "vite-plus";

// Workspace root config. Vite+ reads the `run` block to fan tasks (build/check/test)
// out across the pnpm workspace packages.
export default defineConfig({
  run: {
    // Run the matching script in every workspace package that defines it.
    // (Task graph / caching is handled by Vite+; see https://viteplus.dev/config/.)
  },
  // Make `vp check` the single static-check command: type-aware lint + type checking
  // (run via tsgolint / TypeScript-Go), on top of Oxlint + Oxfmt. `typeAware` is only
  // honored in the workspace-root config, so the lint setup lives here.
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
