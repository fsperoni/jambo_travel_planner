import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors/app-error.js";
import type { TokenService } from "../services/token.service.js";

/**
 * Reads the `Authorization: Bearer <token>` header, verifies it via the
 * injected TokenService, and attaches the result to `req.user` for
 * downstream controllers. Every failure mode — missing header, wrong
 * scheme, invalid signature, expired token, wrong issuer/audience —
 * collapses to the same 401 with the same message. Distinguishing them in
 * the response would only help an attacker refine a forged token; a
 * legitimate client doesn't need more than "log in again" either way.
 */
export function requireAuth(tokenService: TokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (!token) {
      next(new UnauthorizedError("Missing or malformed Authorization header"));
      return;
    }

    try {
      req.user = tokenService.verifyAccessToken(token);
      next();
    } catch {
      next(new UnauthorizedError("Invalid or expired access token"));
    }
  };
}
