import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { createTokenService } from "./token.service.js";
import { TEST_JWT_SECRET as SECRET } from "../../test/helpers/fixtures.js";

describe("token service", () => {
  it("signs a token that verifies back to the same payload", () => {
    const service = createTokenService(SECRET, 900);
    const token = service.signAccessToken({ sub: "user-1", email: "a@b.com" });

    expect(service.verifyAccessToken(token)).toEqual({ sub: "user-1", email: "a@b.com" });
  });

  it("rejects a token signed with a different secret", () => {
    const service = createTokenService(SECRET, 900);
    const otherService = createTokenService("a-completely-different-32-char-secret!!", 900);
    const token = otherService.signAccessToken({ sub: "user-1", email: "a@b.com" });

    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it("rejects an already-expired token", () => {
    // A negative TTL puts `exp` in the past the instant the token is
    // signed — verifying it should behave exactly like a token that
    // expired naturally after being issued.
    const service = createTokenService(SECRET, -1);
    const token = service.signAccessToken({ sub: "user-1", email: "a@b.com" });

    expect(() => service.verifyAccessToken(token)).toThrow(/expired/i);
  });

  it("rejects a token signed with a different algorithm, even with the correct secret", () => {
    const service = createTokenService(SECRET, 900);
    // Bypasses signAccessToken to craft a token using an algorithm we
    // don't intend to trust. verifyAccessToken pins `algorithms: ["HS256"]`
    // explicitly, so a correctly-secret-signed HS384 token must still be
    // rejected rather than silently accepted.
    const token = jwt.sign({ email: "a@b.com" }, SECRET, {
      subject: "user-1",
      algorithm: "HS384",
      issuer: "jambo-api",
      audience: "jambo-web",
    });

    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it("rejects a token with the wrong issuer", () => {
    const service = createTokenService(SECRET, 900);
    const token = jwt.sign({ email: "a@b.com" }, SECRET, {
      subject: "user-1",
      algorithm: "HS256",
      issuer: "someone-else",
      audience: "jambo-web",
    });

    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it("rejects a token with the wrong audience", () => {
    const service = createTokenService(SECRET, 900);
    const token = jwt.sign({ email: "a@b.com" }, SECRET, {
      subject: "user-1",
      algorithm: "HS256",
      issuer: "jambo-api",
      audience: "someone-elses-app",
    });

    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it("rejects garbage input", () => {
    const service = createTokenService(SECRET, 900);
    expect(() => service.verifyAccessToken("not-a-jwt-at-all")).toThrow();
  });
});
