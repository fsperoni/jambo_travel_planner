import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createTokenService } from "../src/services/token.service.js";
import {
  createFakeAuthService,
  createFakeDescriptionService,
  createFakeWeatherService,
} from "./helpers/fakes.js";
import { createTestEnv } from "./helpers/test-env.js";

// Exercises the whole app.ts wiring end to end (Helmet, CORS, JSON parsing,
// the 404 handler, the central error handler) via real HTTP requests through
// Supertest, rather than each middleware in isolation — that's what the
// unit tests next to each middleware file already cover. None of these
// routes touch auth, weather, or description, so fakes (never actually
// called) are enough to satisfy createApp's dependencies without a database
// or a real upstream. tokenService is real (it's cheap and stateless — no
// reason to fake something with no side effects), even though nothing here
// uses it either.
const env = createTestEnv();
const app = createApp({
  env,
  authService: createFakeAuthService(),
  tokenService: createTokenService(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS),
  weatherService: createFakeWeatherService(),
  descriptionService: createFakeDescriptionService(),
});

describe("GET /health", () => {
  it("returns 200 with a minimal status payload", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("sets baseline Helmet security headers", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("an unmatched route", () => {
  it("returns a 404 using the standard error envelope, not Express's default HTML page", async () => {
    const res = await request(app).get("/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "No route for GET /definitely-not-a-route",
      },
    });
  });
});
