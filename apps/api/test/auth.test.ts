import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Pool } from "pg";
import type { Express } from "express";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import { createUserRepository } from "../src/repositories/user.repository.js";
import { createAuthService } from "../src/services/auth.service.js";
import { createTokenService } from "../src/services/token.service.js";
import { createTestPool, truncateAllTables } from "./helpers/db.js";
import { createFakeDescriptionService, createFakeWeatherService } from "./helpers/fakes.js";
import { createTestEnv } from "./helpers/test-env.js";

// Runs the real login flow — Express routing, Zod validation, bcrypt,
// PostgreSQL — against a real database rather than mocking `pg`, so a
// mismatch between the migration's columns and the repository's SQL (or a
// bug in the unique/CHECK constraints) would actually surface here.
describe("POST /api/auth/login", () => {
  const env = createTestEnv();
  let pool: Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  afterEach(async () => {
    await truncateAllTables(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  function buildApp(): Express {
    const userRepository = createUserRepository(pool);
    const tokenService = createTokenService(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS);
    const authService = createAuthService({
      userRepository,
      tokenService,
      accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    });
    // None of these tests touch /api/cities, /api/weather, or
    // /api/city-description, so fakes (never actually called) are enough
    // here — the real protected-route coverage (missing/invalid/valid
    // Bearer token) lives in travel.test.ts, against the actual
    // /api/cities endpoint.
    return createApp({
      env,
      authService,
      tokenService,
      weatherService: createFakeWeatherService(),
      descriptionService: createFakeDescriptionService(),
    });
  }

  it("returns an access token and the user for valid credentials", async () => {
    const userRepository = createUserRepository(pool);
    const passwordHash = await hashPassword("correct horse battery staple");
    await userRepository.create("person@example.com", passwordHash);

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "person@example.com", password: "correct horse battery staple" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      user: { email: "person@example.com" },
    });
    expect(res.body.user.id).toEqual(expect.any(String));
  });

  it("accepts the email case-insensitively, since it's normalized to lowercase", async () => {
    const userRepository = createUserRepository(pool);
    const passwordHash = await hashPassword("correct horse battery staple");
    await userRepository.create("person@example.com", passwordHash);

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "Person@Example.com", password: "correct horse battery staple" });

    expect(res.status).toBe(200);
  });

  it("rejects an unknown email with a generic 401", async () => {
    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
    });
  });

  it("rejects a wrong password with the same generic 401", async () => {
    const userRepository = createUserRepository(pool);
    const passwordHash = await hashPassword("the-real-password");
    await userRepository.create("person@example.com", passwordHash);

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "person@example.com", password: "the-wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("rejects a malformed body with 400", async () => {
    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toBeDefined();
  });

  it("rejects a missing password field with 400", async () => {
    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "person@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // A "does the issued token actually work against requireAuth" test lived
  // here until Stage 4 — it existed only because no protected route existed
  // yet to test that end-to-end. Now that one does, that coverage lives in
  // travel.test.ts against the real /api/cities endpoint instead.
});
