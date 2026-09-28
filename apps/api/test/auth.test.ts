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
import {
  createFakeDescriptionService,
  createFakeLocationService,
  createFakeWeatherService,
} from "./helpers/fakes.js";
import { createTestEnv } from "./helpers/test-env.js";
import { TEST_USER, UNKNOWN_EMAIL } from "./helpers/fixtures.js";

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
    // None of these tests touch /api/cities, /api/weather,
    // /api/city-description, or /api/location, so fakes (never actually
    // called) are enough here — the real protected-route coverage
    // (missing/invalid/valid Bearer token) lives in travel.test.ts,
    // against the actual /api/cities endpoint.
    return createApp({
      env,
      authService,
      tokenService,
      weatherService: createFakeWeatherService(),
      descriptionService: createFakeDescriptionService(),
      locationService: createFakeLocationService(),
    });
  }

  it("returns an access token and the user for valid credentials", async () => {
    const userRepository = createUserRepository(pool);
    const passwordHash = await hashPassword(TEST_USER.password);
    await userRepository.create(TEST_USER.email, passwordHash);

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      user: { email: TEST_USER.email },
    });
    expect(res.body.user.id).toEqual(expect.any(String));
  });

  it("accepts the email case-insensitively, since it's normalized to lowercase", async () => {
    const userRepository = createUserRepository(pool);
    const passwordHash = await hashPassword(TEST_USER.password);
    await userRepository.create(TEST_USER.email, passwordHash);

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "Person@Example.com", password: TEST_USER.password });

    expect(res.status).toBe(200);
  });

  it("rejects an unknown email with a generic 401", async () => {
    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: UNKNOWN_EMAIL, password: "whatever" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
    });
  });

  it("rejects a wrong password with the same generic 401", async () => {
    const userRepository = createUserRepository(pool);
    const passwordHash = await hashPassword(TEST_USER.password);
    await userRepository.create(TEST_USER.email, passwordHash);

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, password: "the-wrong-password" });

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
    const res = await request(buildApp()).post("/api/auth/login").send({ email: TEST_USER.email });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // A "does the issued token actually work against requireAuth" test used
  // to live here, back when no protected route existed yet to test that
  // end-to-end. Now that one does, that coverage lives in travel.test.ts
  // against the real /api/cities endpoint instead.
});
