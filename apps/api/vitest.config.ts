import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests live next to their source file (src/**/*.test.ts).
    // Integration tests live under test/ instead, since they exercise
    // createApp() over real HTTP with a real PostgreSQL instance behind it
    // (via TEST_DATABASE_URL) rather than testing one function in isolation.
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Everything under src/ counts, with a short, explicit exclude list
      // for the handful of files that are structurally untestable rather
      // than merely inconvenient: server.ts is the composition root (wires
      // real config into `.listen()` — nothing to unit test that
      // integration tests don't already exercise via createApp()),
      // db/pool.ts is a one-line `pg.Pool` constructor call, types/** are
      // type-only declarations with no runtime code, and raw-types.ts
      // files are vendor response shapes, also type-only. There's no
      // global target; the goal is an honest number for real business
      // logic, not a 100% figure achieved by narrowing what's counted.
      include: ["src/**"],
      exclude: [
        "src/**/*.test.ts",
        "src/server.ts",
        "src/db/pool.ts",
        "src/types/**",
        "src/**/raw-types.ts",
      ],
    },
  },
});
