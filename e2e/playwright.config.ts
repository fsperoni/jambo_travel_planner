import { defineConfig, devices } from "@playwright/test";

// Dedicated ports, distinct from the normal local-dev ones (3000/5173) —
// so this suite never collides with a developer's own `npm run dev`
// already running in another terminal.
const API_PORT = 4000;
const WEB_PORT = 4173;
const OPEN_METEO_STUB_PORT = 4010;
const WIKIPEDIA_STUB_PORT = 4011;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  globalSetup: "./global-setup.ts",

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },

  // One browser is enough for a single happy-path suite — this isn't a
  // cross-browser compatibility test, it's a "does the real stack actually
  // wire together" test. Chromium is the most common baseline.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      command: `npm run dev -w @jambo/api`,
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      // Above Playwright's 60s default — a cold CI runner installing
      // Chromium right before this step has less headroom than a local
      // machine with tsx/vite already warm in disk cache.
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        NODE_ENV: "test",
        // Reuses the same test database the backend's own integration
        // tests run against — see global-setup.ts for why.
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
        JWT_SECRET: "e2e-test-jwt-secret-at-least-32-characters-long",
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        OPEN_METEO_BASE_URL: `http://localhost:${OPEN_METEO_STUB_PORT}`,
        WIKIPEDIA_BASE_URL: `http://localhost:${WIKIPEDIA_STUB_PORT}`,
        WIKIPEDIA_USER_AGENT: "JamboTravelPlanner-e2e/0.1 (not a real request) node",
        // Deliberately unreachable, with no stub behind it at all: with
        // TRUST_PROXY_HOPS=0 and Playwright's browser connecting over
        // loopback, location.service.ts's isLoopback() check short-circuits
        // before this URL would ever be requested — see the README's
        // testing strategy. If that ever stopped being true, this would
        // fail loudly (a DNS/connection error) instead of silently hitting
        // a real upstream.
        IP_GEOLOCATION_BASE_URL: "http://ip-geolocation.e2e-not-called.invalid",
        TRUST_PROXY_HOPS: "0",
        DEFAULT_CITY_ID: "calgary",
      },
    },
    {
      command: `npm run dev -w @jambo/web -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
