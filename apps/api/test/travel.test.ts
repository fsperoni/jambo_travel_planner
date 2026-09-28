import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app.js";
import { UpstreamError } from "../src/errors/app-error.js";
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

  it("returns 400 for a blank latitude, rather than silently treating it as 0", async () => {
    // A real bug Codex's review found: z.coerce.number() alone parses ""
    // as 0, so `?latitude=&longitude=0` used to succeed with a real
    // (wrong) coordinate instead of a validation error.
    const res = await authedGet("/api/weather?latitude=&longitude=0");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for a whitespace-only latitude", async () => {
    const res = await authedGet("/api/weather?latitude=%20%20&longitude=0");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for hex/exponential-notation coordinates, not just non-numeric ones", async () => {
    // z.coerce.number() alone also parses "0x10" as 16 and "1e1" as 10 —
    // neither is a plain decimal number a real client would send for a
    // coordinate.
    const hex = await authedGet("/api/weather?latitude=0x10&longitude=0");
    const exponential = await authedGet("/api/weather?latitude=1e1&longitude=0");

    expect(hex.status).toBe(400);
    expect(exponential.status).toBe(400);
  });

  it("returns 400 for a repeated latitude query parameter", async () => {
    const res = await authedGet("/api/weather?latitude=1&latitude=2&longitude=0");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts a real 0 for either coordinate", async () => {
    const getWeatherReport = vi.fn().mockResolvedValue(buildWeatherReport());

    const res = await authedGet(
      "/api/weather?latitude=0&longitude=0",
      buildApp({ weatherService: createFakeWeatherService({ getWeatherReport }) }),
    );

    expect(res.status).toBe(200);
    expect(getWeatherReport).toHaveBeenCalledWith(0, 0);
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
    expect(getWeatherReport).toHaveBeenCalledWith(51.0447, -114.0719);
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

  it("returns 400 for a whitespace-only title, rather than forwarding it to the Wikipedia client", async () => {
    const res = await authedGet("/api/city-description?title=%20%20");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("trims surrounding whitespace from a real title before passing it to the description service", async () => {
    const getCityDescription = vi
      .fn()
      .mockResolvedValue({ title: "Calgary", description: "A city.", sourceUrl: null });

    const res = await authedGet(
      "/api/city-description?title=%20Calgary%20",
      buildApp({ descriptionService: createFakeDescriptionService({ getCityDescription }) }),
    );

    expect(res.status).toBe(200);
    expect(getCityDescription).toHaveBeenCalledWith("Calgary");
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
    // 3, not 1: confirmed empirically against the real Render deployment
    // (a temporary debug endpoint echoed the raw header back — see the
    // 2026-09-28 AI_USAGE.md entry), not assumed. Render's real chain has
    // three trusted entries in front of the app — the visitor's own IP,
    // then Cloudflare's edge, then Render's own internal load balancer —
    // so Express's numeric `trust proxy` must count 3 hops from the right
    // to land back on the visitor's own IP, correctly ignoring a spoofed
    // leftmost entry a client could freely set on their own request.
    const detectLocation = vi
      .fn()
      .mockResolvedValue({ city: calgary, source: "default", reason: "lookup-failed" });

    await authedGet(
      "/api/location",
      buildApp({
        locationService: createFakeLocationService({ detectLocation }),
        trustProxyHops: 3,
      }),
    ).set("X-Forwarded-For", "9.9.9.9, 70.65.124.163, 162.159.102.35, 10.192.34.107");

    expect(detectLocation).toHaveBeenCalledWith("70.65.124.163");
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
