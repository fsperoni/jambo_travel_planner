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
    // ".invalid" is reserved by RFC 2606 to never resolve — a loud, obvious
    // failure for any test that forgets to override this with a stub
    // server URL, rather than a real (if wrong) address that might behave
    // unpredictably.
    OPEN_METEO_BASE_URL: "http://open-meteo.invalid",
    WIKIPEDIA_BASE_URL: "http://wikipedia.invalid",
    WIKIPEDIA_USER_AGENT: "JamboTravelPlanner/test (test-env.ts) node",
    ...overrides,
  };
}
