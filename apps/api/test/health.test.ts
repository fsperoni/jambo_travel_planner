import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createFakeAuthService } from "./helpers/fakes.js";
import { createTestEnv } from "./helpers/test-env.js";

// Exercises the whole app.ts wiring end to end (Helmet, CORS, JSON parsing,
// the 404 handler, the central error handler) via real HTTP requests through
// Supertest, rather than each middleware in isolation — that's what the
// unit tests next to each middleware file already cover. None of these
// routes touch auth, so a fake AuthService (never actually called) is
// enough to satisfy createApp's dependencies without a database.
const app = createApp({ env: createTestEnv(), authService: createFakeAuthService() });

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
