import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // No tests exist yet at the tooling-scaffold stage; real unit/integration
    // tests land starting Stage 1, at which point this stays harmless.
    passWithNoTests: true,
    // Integration tests (test/**) hit a real PostgreSQL instance and are kept
    // separate from unit tests so `vitest run` stays fast and dependency-free
    // by default; CI runs both because DATABASE_URL is provided there.
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/services/**", "src/domain/**", "src/clients/**/mapper.ts"],
    },
  },
});
