import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./require-auth.js";
import { UnauthorizedError } from "../errors/app-error.js";
import { createFakeTokenService as fakeTokenService } from "../../test/helpers/fakes.js";

function fakeRequest(headers: Record<string, string> = {}): Request {
  return {
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe("requireAuth", () => {
  it("attaches req.user and calls next() with no error when the token is valid", () => {
    const payload = { sub: "user-1", email: "a@b.com" };
    const tokenService = fakeTokenService({ verifyAccessToken: vi.fn().mockReturnValue(payload) });
    const req = fakeRequest({ authorization: "Bearer valid-token" });
    const next = vi.fn();

    requireAuth(tokenService)(req, {} as Response, next as NextFunction);

    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects with 401 when the Authorization header is missing", () => {
    const tokenService = fakeTokenService();
    const req = fakeRequest({});
    const next = vi.fn();

    requireAuth(tokenService)(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const [err] = next.mock.calls[0] as [unknown];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it("rejects with 401 when the header doesn't use the Bearer scheme", () => {
    const tokenService = fakeTokenService();
    const req = fakeRequest({ authorization: "Basic abc123" });
    const next = vi.fn();

    requireAuth(tokenService)(req, {} as Response, next as NextFunction);

    const [err] = next.mock.calls[0] as [unknown];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it("rejects with 401 when verification throws — invalid, expired, or wrong-secret token", () => {
    const tokenService = fakeTokenService({
      verifyAccessToken: vi.fn().mockImplementation(() => {
        throw new Error("jwt expired");
      }),
    });
    const req = fakeRequest({ authorization: "Bearer expired-token" });
    const next = vi.fn();

    requireAuth(tokenService)(req, {} as Response, next as NextFunction);

    const [err] = next.mock.calls[0] as [unknown];
    expect(err).toBeInstanceOf(UnauthorizedError);
    // The specific reason (expired vs tampered vs wrong secret) never
    // reaches the client — see the comment in require-auth.ts on why.
    expect((err as UnauthorizedError).message).toBe("Invalid or expired access token");
  });

  it("never attaches req.user when verification fails", () => {
    const tokenService = fakeTokenService({
      verifyAccessToken: vi.fn().mockImplementation(() => {
        throw new Error("boom");
      }),
    });
    const req = fakeRequest({ authorization: "Bearer bad-token" });

    requireAuth(tokenService)(req, {} as Response, vi.fn() as NextFunction);

    expect(req.user).toBeUndefined();
  });
});
