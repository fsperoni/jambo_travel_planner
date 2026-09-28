import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app.js";
import { ForecastDateOutOfRangeError, UpstreamError } from "../src/errors/app-error.js";
import type { City } from "../src/domain/city-catalogue.js";
import type { DetectedLocation } from "../src/services/location.service.js";
import type { CityDescription } from "../src/types/city-description.js";
import { createTokenService } from "../src/services/token.service.js";
import {
  createFakeAuthService,
  createFakeDescriptionService,
  createFakeLocationService,
  createFakeWeatherService,
} from "./helpers/fakes.js";
import { createTestEnv } from "./helpers/test-env.js";
import { TEST_USER, buildWeatherReport } from "./helpers/fixtures.js";

// Neither /api/cities, /api/weather, /api/city-description, nor
// /api/location touches PostgreSQL, so — unlike auth.test.ts — this file
// needs no real database, just fake services injected via createApp()'s
// dependencies. The city catalogue itself is fully covered by
// domain/city-catalogue.test.ts; this file is about the *routes* — auth,
// validation, and response wiring.
const env = createTestEnv();
const tokenService = createTokenService(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS);
const validToken = tokenService.signAccessToken({ sub: TEST_USER.id, email: TEST_USER.email });

function buildApp({
  weatherService = createFakeWeatherService(),
  descriptionService = createFakeDescriptionService(),
  locationService = createFakeLocationService(),
  trustProxyHops,
}: {
  weatherService?: ReturnType<typeof createFakeWeatherService>;
  descriptionService?: ReturnType<typeof createFakeDescriptionService>;
  locationService?: ReturnType<typeof createFakeLocationService>;
  trustProxyHops?: number;
} = {}): Express {
  return createApp({
    env: trustProxyHops === undefined ? env : { ...env, TRUST_PROXY_HOPS: trustProxyHops },
    authService: createFakeAuthService(),
    tokenService,
    weatherService,
    descriptionService,
    locationService,
  });
}

/** GET `path` against `app` (default: a fresh buildApp()) with a valid
 *  Bearer token already attached — nearly every test below needs one, and
 *  a bare `request(app).get(path)` remains available for the handful of
 *  "returns 401 with no Authorization header" tests that specifically
 *  don't want it. */
function authedGet(path: string, app: Express = buildApp()) {
  return request(app).get(path).set("Authorization", `Bearer ${validToken}`);
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
    const res = await authedGet("/api/cities");

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
    const res = await authedGet("/api/weather");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for an out-of-range latitude", async () => {
    const res = await authedGet("/api/weather?latitude=999&longitude=0");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns the weather service's report for valid coordinates", async () => {
    const report = buildWeatherReport();
    const getWeatherReport = vi.fn().mockResolvedValue(report);

    const res = await authedGet(
      "/api/weather?latitude=51.0447&longitude=-114.0719",
      buildApp({ weatherService: createFakeWeatherService({ getWeatherReport }) }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(report);
    expect(getWeatherReport).toHaveBeenCalledWith(51.0447, -114.0719, undefined);
  });

  it("returns a structured 502 when the weather service reports an upstream failure", async () => {
    const getWeatherReport = vi
      .fn()
      .mockRejectedValue(
        new UpstreamError(502, "Upstream api.open-meteo.com responded with status 503"),
      );

    const res = await authedGet(
      "/api/weather?latitude=51.0447&longitude=-114.0719",
      buildApp({ weatherService: createFakeWeatherService({ getWeatherReport }) }),
    );

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

    const res = await authedGet(
      "/api/weather?latitude=51.0447&longitude=-114.0719",
      buildApp({ weatherService: createFakeWeatherService({ getWeatherReport }) }),
    );

    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
  });

  it("passes a valid date through to the weather service", async () => {
    const report = buildWeatherReport();
    const getWeatherReport = vi.fn().mockResolvedValue(report);

    const res = await authedGet(
      "/api/weather?latitude=51.0447&longitude=-114.0719&date=2026-09-27",
      buildApp({ weatherService: createFakeWeatherService({ getWeatherReport }) }),
    );

    expect(res.status).toBe(200);
    expect(getWeatherReport).toHaveBeenCalledWith(51.0447, -114.0719, "2026-09-27");
  });

  it("returns 400 for a date that isn't in YYYY-MM-DD format", async () => {
    const res = await authedGet(
      "/api/weather?latitude=51.0447&longitude=-114.0719&date=09/27/2026",
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for a date that doesn't exist on the calendar", async () => {
    const res = await authedGet(
      "/api/weather?latitude=51.0447&longitude=-114.0719&date=2026-02-30",
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 FORECAST_DATE_OUT_OF_RANGE, with the valid range in details, for a date the service rejects", async () => {
    const getWeatherReport = vi
      .fn()
      .mockRejectedValue(new ForecastDateOutOfRangeError({ min: "2026-09-27", max: "2026-10-02" }));

    const res = await authedGet(
      "/api/weather?latitude=51.0447&longitude=-114.0719&date=2026-10-05",
      buildApp({ weatherService: createFakeWeatherService({ getWeatherReport }) }),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FORECAST_DATE_OUT_OF_RANGE");
    expect(res.body.error.details).toEqual({ min: "2026-09-27", max: "2026-10-02" });
  });
});

describe("GET /api/city-description", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await request(buildApp()).get("/api/city-description?title=Calgary");
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    const res = await authedGet("/api/city-description");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns the description service's result for a valid title", async () => {
    const cityDescription: CityDescription = {
      title: "Calgary",
      description: "Calgary is the largest city in the Canadian province of Alberta.",
      sourceUrl: "https://en.wikipedia.org/wiki/Calgary",
    };
    const getCityDescription = vi.fn().mockResolvedValue(cityDescription);

    const res = await authedGet(
      "/api/city-description?title=Calgary",
      buildApp({ descriptionService: createFakeDescriptionService({ getCityDescription }) }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cityDescription);
    expect(getCityDescription).toHaveBeenCalledWith("Calgary");
  });

  it("returns 200 with description: null for a title with no matching article (D3: not a failure)", async () => {
    const getCityDescription = vi
      .fn()
      .mockResolvedValue({ title: "NotARealPlace", description: null, sourceUrl: null });

    const res = await authedGet(
      "/api/city-description?title=NotARealPlace",
      buildApp({ descriptionService: createFakeDescriptionService({ getCityDescription }) }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ title: "NotARealPlace", description: null, sourceUrl: null });
  });

  it("returns a structured 502 when the description service reports an upstream failure", async () => {
    const getCityDescription = vi
      .fn()
      .mockRejectedValue(
        new UpstreamError(502, "Upstream en.wikipedia.org responded with status 503"),
      );

    const res = await authedGet(
      "/api/city-description?title=Calgary",
      buildApp({ descriptionService: createFakeDescriptionService({ getCityDescription }) }),
    );

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
  });

  it("URL-encodes a title with special characters correctly when passed through to the service", async () => {
    const getCityDescription = vi
      .fn()
      .mockResolvedValue({ title: "São Paulo", description: "A city in Brazil.", sourceUrl: null });

    const res = await authedGet(
      `/api/city-description?title=${encodeURIComponent("São Paulo")}`,
      buildApp({ descriptionService: createFakeDescriptionService({ getCityDescription }) }),
    );

    expect(res.status).toBe(200);
    expect(getCityDescription).toHaveBeenCalledWith("São Paulo");
  });
});

describe("GET /api/location", () => {
  const calgary: City = {
    id: "calgary",
    name: "Calgary",
    region: "Alberta",
    countryCode: "CA",
    latitude: 51.05,
    longitude: -114.07,
    wikipediaTitle: "Calgary",
  };

  it("returns 401 with no Authorization header", async () => {
    const res = await request(buildApp()).get("/api/location");
    expect(res.status).toBe(401);
  });

  it("returns the detected location from the service as-is", async () => {
    const detected: DetectedLocation = {
      city: {
        id: "sao-paulo",
        name: "São Paulo",
        region: "São Paulo",
        countryCode: "BR",
        latitude: -23.55,
        longitude: -46.63,
        wikipediaTitle: "São Paulo",
      },
      source: "ip",
    };
    const detectLocation = vi.fn().mockResolvedValue(detected);

    const res = await authedGet(
      "/api/location",
      buildApp({ locationService: createFakeLocationService({ detectLocation }) }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(detected);
  });

  it("returns the default-city fallback shape, including its reason, unchanged", async () => {
    const detected: DetectedLocation = {
      city: calgary,
      source: "default",
      reason: "lookup-failed",
    };
    const detectLocation = vi.fn().mockResolvedValue(detected);

    const res = await authedGet(
      "/api/location",
      buildApp({ locationService: createFakeLocationService({ detectLocation }) }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(detected);
  });

  it("passes the correct client IP to the location service, per TRUST_PROXY_HOPS", async () => {
    // Confirmed empirically, not assumed: with exactly one trusted hop,
    // Express's req.ip is the *last* entry of X-Forwarded-For — the
    // address our own (trusted) reverse proxy actually observed — which
    // correctly ignores a spoofed leftmost entry a client could freely set
    // on their own request.
    const detectLocation = vi
      .fn()
      .mockResolvedValue({ city: calgary, source: "default", reason: "lookup-failed" });

    await authedGet(
      "/api/location",
      buildApp({
        locationService: createFakeLocationService({ detectLocation }),
        trustProxyHops: 1,
      }),
    ).set("X-Forwarded-For", "9.9.9.9, 203.0.113.5");

    expect(detectLocation).toHaveBeenCalledWith("203.0.113.5");
  });

  it("ignores X-Forwarded-For entirely when TRUST_PROXY_HOPS is 0 (the local-dev default)", async () => {
    const detectLocation = vi
      .fn()
      .mockResolvedValue({ city: calgary, source: "default", reason: "lookup-failed" });

    await authedGet(
      "/api/location",
      buildApp({
        locationService: createFakeLocationService({ detectLocation }),
        trustProxyHops: 0,
      }),
    ).set("X-Forwarded-For", "9.9.9.9");

    // Supertest connects over a real loopback socket, so with X-Forwarded-For
    // ignored, req.ip is the test runner's own loopback address — never the
    // spoofed header value a client fully controls.
    expect(detectLocation).not.toHaveBeenCalledWith("9.9.9.9");
  });
});
