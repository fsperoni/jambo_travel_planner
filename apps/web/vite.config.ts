/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite bundles the app; the same config also configures Vitest (the `test`
// key), so the dev/build/test pipelines share one source of truth for
// plugins and module resolution instead of drifting apart.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // An explicit scope, not just whatever v8 happened to load: without
      // this, a review pass found the coverage report silently counting
      // src/test/fixtures.ts and the MSW handlers built from them (test
      // infrastructure, not application code) in the denominator — a false
      // "the app is well covered" signal that had nothing to do with the
      // app's own logic. main.tsx (the DOM bootstrap, analogous to the
      // backend's server.ts) and api/types.ts (type-only interfaces, no
      // runtime code) are excluded for the same "nothing to unit test
      // here" reasoning as the backend's own exclude list.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx", "src/api/types.ts"],
      // A floor, not a target — comfortably below the real, current
      // numbers (97%+ stmts/lines, 93%+ branches, 96%+ funcs), so this
      // fails CI on an actual regression rather than on ordinary
      // fluctuation as new, lightly-tested code is added. No 100% target;
      // see the README's testing-strategy section for what's excluded and
      // why.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
