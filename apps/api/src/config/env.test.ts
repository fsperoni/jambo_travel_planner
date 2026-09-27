import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

// The variables loadEnv has no default for. Individual tests spread this
// in and override just the field they're actually exercising, so each
// test's intent stays visible without repeating every required field.
const requiredBase = {
  DATABASE_URL: "postgres://user:pw@localhost:5432/db",
  JWT_SECRET: "a-test-secret-that-is-at-least-32-characters",
};

describe("loadEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    const env = loadEnv(requiredBase);
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(["http://localhost:5173"]);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.DEFAULT_CITY_ID).toBe("calgary");
    expect(env.TRUST_PROXY_HOPS).toBe(0);
  });

  it("parses a comma-separated CORS_ORIGINS into a trimmed array", () => {
    const env = loadEnv({ ...requiredBase, CORS_ORIGINS: " http://a.test , http://b.test" });
    expect(env.CORS_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
  });

  it("coerces PORT from a string", () => {
    const env = loadEnv({ ...requiredBase, PORT: "4000" });
    expect(env.PORT).toBe(4000);
  });

  it("coerces ACCESS_TOKEN_TTL_SECONDS from a string", () => {
    const env = loadEnv({ ...requiredBase, ACCESS_TOKEN_TTL_SECONDS: "60" });
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(60);
  });

  it("rejects an invalid NODE_ENV with a readable error", () => {
    expect(() => loadEnv({ ...requiredBase, NODE_ENV: "staging" })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it("rejects a non-numeric PORT, naming the offending field", () => {
    expect(() => loadEnv({ ...requiredBase, PORT: "not-a-number" })).toThrow(/PORT/);
  });

  it("rejects a missing DATABASE_URL, naming the offending field", () => {
    const { DATABASE_URL: _unused, ...withoutDatabaseUrl } = requiredBase;
    expect(() => loadEnv(withoutDatabaseUrl)).toThrow(/DATABASE_URL/);
  });

  it("rejects a DATABASE_URL that isn't a valid URL", () => {
    expect(() => loadEnv({ ...requiredBase, DATABASE_URL: "not-a-url" })).toThrow(/DATABASE_URL/);
  });

  it("rejects a JWT_SECRET shorter than 32 characters", () => {
    expect(() => loadEnv({ ...requiredBase, JWT_SECRET: "too-short" })).toThrow(/JWT_SECRET/);
  });

  it("coerces TRUST_PROXY_HOPS from a string", () => {
    const env = loadEnv({ ...requiredBase, TRUST_PROXY_HOPS: "1" });
    expect(env.TRUST_PROXY_HOPS).toBe(1);
  });

  it("rejects a DEFAULT_CITY_ID that isn't a real city in the catalogue", () => {
    expect(() => loadEnv({ ...requiredBase, DEFAULT_CITY_ID: "atlantis" })).toThrow(
      /DEFAULT_CITY_ID/,
    );
  });

  it("accepts a DEFAULT_CITY_ID that is a real catalogue id", () => {
    const env = loadEnv({ ...requiredBase, DEFAULT_CITY_ID: "sao-paulo" });
    expect(env.DEFAULT_CITY_ID).toBe("sao-paulo");
  });
});
