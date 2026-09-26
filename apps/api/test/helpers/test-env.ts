import type { Env } from "../../src/config/env.js";

/**
 * A minimal, valid Env object for tests that build createApp() directly.
 * Bypasses loadEnv()/Zod entirely — env parsing and validation itself is
 * covered by config/env.test.ts, so tests that just need "some valid env"
 * to construct the app shouldn't also have to satisfy Zod each time.
 */
export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: "test",
    PORT: 3000,
    CORS_ORIGINS: ["http://localhost:5173"],
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    JWT_SECRET: "test-jwt-secret-at-least-32-characters-long",
    ACCESS_TOKEN_TTL_SECONDS: 900,
    ...overrides,
  };
}
