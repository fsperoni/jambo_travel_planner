import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app.js";
import { UpstreamError } from "../src/errors/app-error.js";
import { createTokenService } from "../src/services/token.service.js";
import type { WeatherReport } from "../src/services/weather.service.js";
import { createFakeAuthService, createFakeWeatherService } from "./helpers/fakes.js";
import { createTestEnv } from "./helpers/test-env.js";

// Neither /api/cities nor /api/weather touches PostgreSQL, so — unlike
// auth.test.ts — this file needs no real database, just a fake
// WeatherService injected via createApp()'s dependencies. The city
// catalogue itself is fully covered by domain/city-catalogue.test.ts; this
// file is about the *route* — auth, validation, and response wiring.
const env = createTestEnv();
const tokenService = createTokenService(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS);
const validToken = tokenService.signAccessToken({ sub: "user-1", email: "person@example.com" });

function buildApp(weatherService = createFakeWeatherService()): Express {
  return createApp({ env, authService: createFakeAuthService(), tokenService, weatherService });
}

function makeReport(): WeatherReport {
  return {
    timezone: "America/Edmonton",
    localDate: "2026-09-25",
    allowedForecastDates: { min: "2026-09-25", max: "2026-09-30" },
    units: { temperature: "°C", windSpeed: "km/h", precipitationProbability: "%" },
    current: {
      observedAt: "2026-09-25T20:30",
      temperature: 13.4,
      feelsLike: 8.9,
      humidity: 40,
      windSpeed: 16.1,
      isDay: false,
      condition: { code: 2, label: "Partly cloudy" },
    },
    week: [],
  };
}

describe("GET /api/cities", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await request(buildApp()).get("/api/cities");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid token", async () => {
    const res = await request(buildApp())
      .get("/api/cities")
      .set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(401);
  });

  it("returns the city catalogue with a valid token", async () => {
    const res = await request(buildApp())
      .get("/api/cities")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      countryCode: expect.any(String),
      latitude: expect.any(Number),
      longitude: expect.any(Number),
      wikipediaTitle: expect.any(String),
    });
  });
});

describe("GET /api/weather", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await request(buildApp()).get("/api/weather?latitude=51.05&longitude=-114.07");
    expect(res.status).toBe(401);
  });

  it("returns 400 when coordinates are missing", async () => {
    const res = await request(buildApp())
      .get("/api/weather")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for an out-of-range latitude", async () => {
    const res = await request(buildApp())
      .get("/api/weather?latitude=999&longitude=0")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns the weather service's report for valid coordinates", async () => {
    const report = makeReport();
    const getWeatherReport = vi.fn().mockResolvedValue(report);

    const res = await request(buildApp(createFakeWeatherService({ getWeatherReport })))
      .get("/api/weather?latitude=51.0447&longitude=-114.0719")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(report);
    expect(getWeatherReport).toHaveBeenCalledWith(51.0447, -114.0719);
  });

  it("returns a structured 502 when the weather service reports an upstream failure", async () => {
    const getWeatherReport = vi
      .fn()
      .mockRejectedValue(
        new UpstreamError(502, "Upstream api.open-meteo.com responded with status 503"),
      );

    const res = await request(buildApp(createFakeWeatherService({ getWeatherReport })))
      .get("/api/weather?latitude=51.0447&longitude=-114.0719")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
    // No stack trace, no upstream response body, no internal detail — same
    // guarantee middleware/error-handler.ts already enforces generally.
    expect(res.body.error).not.toHaveProperty("stack");
  });

  it("returns a structured 504 when the weather service reports an upstream timeout", async () => {
    const getWeatherReport = vi
      .fn()
      .mockRejectedValue(new UpstreamError(504, "Upstream api.open-meteo.com timed out"));

    const res = await request(buildApp(createFakeWeatherService({ getWeatherReport })))
      .get("/api/weather?latitude=51.0447&longitude=-114.0719")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
  });
});
