import { describe, expect, it } from "vitest";
import { parseSeedUsers } from "./seed-users.js";

describe("parseSeedUsers", () => {
  it("parses a single email:password pair", () => {
    expect(parseSeedUsers("demo@example.com:hunter22")).toEqual([
      { email: "demo@example.com", password: "hunter22" },
    ]);
  });

  it("parses multiple comma-separated pairs, trimming whitespace", () => {
    expect(parseSeedUsers(" a@example.com:pw1 , b@example.com:pw2 ")).toEqual([
      { email: "a@example.com", password: "pw1" },
      { email: "b@example.com", password: "pw2" },
    ]);
  });

  it("ignores empty entries from trailing/stray commas", () => {
    expect(parseSeedUsers("a@example.com:pw1,,")).toEqual([
      { email: "a@example.com", password: "pw1" },
    ]);
  });

  it("throws on an entry missing the password", () => {
    expect(() => parseSeedUsers("a@example.com")).toThrow(/Malformed SEED_USERS entry/);
  });

  it("throws on an entry missing the email", () => {
    expect(() => parseSeedUsers(":password-only")).toThrow(/Malformed SEED_USERS entry/);
  });

  it("throws when a password exceeds bcrypt's 72-byte limit", () => {
    const longPassword = "a".repeat(73);
    expect(() => parseSeedUsers(`a@example.com:${longPassword}`)).toThrow(/72-byte limit/);
  });

  it("accepts a password at exactly the 72-byte boundary", () => {
    const boundaryPassword = "a".repeat(72);
    expect(() => parseSeedUsers(`a@example.com:${boundaryPassword}`)).not.toThrow();
  });

  it("measures the limit in bytes, not characters, for multi-byte passwords", () => {
    // "é" is 1 UTF-16 code unit but 2 UTF-8 bytes — 40 of them is 40
    // characters but 80 bytes, over the limit despite looking short.
    const multiByteOverLimit = "é".repeat(40);
    expect(() => parseSeedUsers(`a@example.com:${multiByteOverLimit}`)).toThrow(/72-byte limit/);
  });
});
