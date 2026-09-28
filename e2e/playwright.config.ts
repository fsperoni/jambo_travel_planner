import { defineConfig, devices } from "@playwright/test";
import { CALGARY, PORTS } from "./fixtures.js";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  globalSetup: "./global-setup.ts",

  use: {
    baseURL: `http://localhost:${PORTS.web}`,
    trace: "retain-on-failure",
  },

  // One browser is enough for a single happy-path suite — this isn't a
  // cross-browser compatibility test, it's a "does the real stack actually
  // wire together" test. Chromium is the most common baseline.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      command: `npm run dev -w @jambo/api`,
      url: `http://localhost:${PORTS.api}/health`,
      reuseExistingServer: !process.env.CI,
      // Above Playwright's 60s default — a cold CI runner installing
      // Chromium right before this step has less headroom than a local
      // machine with tsx/vite already warm in disk cache.
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(PORTS.api),
        NODE_ENV: "test",
        // Reuses the same test database the backend's own integration
        // tests run against — see global-setup.ts for why.
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
        JWT_SECRET: "e2e-test-jwt-secret-at-least-32-characters-long",
        CORS_ORIGINS: `http://localhost:${PORTS.web}`,
        OPEN_METEO_BASE_URL: `http://localhost:${PORTS.openMeteoStub}`,
        WIKIPEDIA_BASE_URL: `http://localhost:${PORTS.wikipediaStub}`,
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
        DEFAULT_CITY_ID: CALGARY.id,
      },
    },
    {
      command: `npm run dev -w @jambo/web -- --port ${PORTS.web} --strictPort`,
      url: `http://localhost:${PORTS.web}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://localhost:${PORTS.api}`,
      },
    },
  ],
});
