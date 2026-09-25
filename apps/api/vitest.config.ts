import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests live next to their source file (src/**/*.test.ts).
    // Integration tests live under test/ instead, since from Stage 2 onward
    // they exercise createApp() over real HTTP with a real PostgreSQL
    // instance behind it (via TEST_DATABASE_URL) rather than testing one
    // function in isolation.
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Coverage is tracked for code with real business logic to get
      // wrong — validation, error mapping, config parsing, and (from
      // Stage 2 on) services/domain/client mappers — not for boilerplate
      // like route wiring or the server bootstrap. There's no global
      // target; the goal is meaningful coverage, not a 100% number.
      include: [
        "src/config/**",
        "src/errors/**",
        "src/middleware/**",
        "src/services/**",
        "src/domain/**",
        "src/clients/**/mapper.ts",
      ],
    },
  },
});
