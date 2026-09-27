import { describe, expect, it } from "vitest";
import { isLoopback, normalizeIp } from "./client-ip.js";

describe("normalizeIp", () => {
  it("strips the IPv4-mapped IPv6 prefix", () => {
    expect(normalizeIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
  });

  it("leaves a plain IPv4 address unchanged", () => {
    expect(normalizeIp("203.0.113.5")).toBe("203.0.113.5");
  });

  it("leaves a plain IPv6 address unchanged", () => {
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8::1");
  });
});

describe("isLoopback", () => {
  it("recognizes IPv4 loopback", () => {
    expect(isLoopback("127.0.0.1")).toBe(true);
  });

  it("recognizes IPv6 loopback", () => {
    expect(isLoopback("::1")).toBe(true);
  });

  it("recognizes an IPv4-mapped loopback once normalized", () => {
    expect(isLoopback(normalizeIp("::ffff:127.0.0.1"))).toBe(true);
  });

  it("returns false for a real public IP", () => {
    expect(isLoopback("203.0.113.5")).toBe(false);
  });
});
