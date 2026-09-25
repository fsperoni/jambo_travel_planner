import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    const env = loadEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(["http://localhost:5173"]);
  });

  it("parses a comma-separated CORS_ORIGINS into a trimmed array", () => {
    const env = loadEnv({ CORS_ORIGINS: " http://a.test , http://b.test" });
    expect(env.CORS_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
  });

  it("coerces PORT from a string", () => {
    const env = loadEnv({ PORT: "4000" });
    expect(env.PORT).toBe(4000);
  });

  it("rejects an invalid NODE_ENV with a readable error", () => {
    expect(() => loadEnv({ NODE_ENV: "staging" })).toThrow(/Invalid environment configuration/);
  });

  it("rejects a non-numeric PORT, naming the offending field", () => {
    expect(() => loadEnv({ PORT: "not-a-number" })).toThrow(/PORT/);
  });
});
