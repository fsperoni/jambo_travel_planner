import jwt from "jsonwebtoken";

// Not configurable via env: unlike the secret or the TTL, there's no
// deployment-time reason these would ever need to differ, so they're
// constants rather than one more thing to get wrong in an env file.
const ISSUER = "jambo-api";
const AUDIENCE = "jambo-web";

export interface AccessTokenPayload {
  /** User id — carried as the JWT's registered `sub` claim. */
  sub: string;
  email: string;
}

export interface TokenService {
  signAccessToken(payload: AccessTokenPayload): string;
  /** Throws if the token is missing, malformed, expired, or has an
   *  invalid signature/issuer/audience — never returns a partial result. */
  verifyAccessToken(token: string): AccessTokenPayload;
}

export function createTokenService(secret: string, ttlSeconds: number): TokenService {
  return {
    signAccessToken({ sub, email }) {
      return jwt.sign({ email }, secret, {
        subject: sub,
        expiresIn: ttlSeconds,
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithm: "HS256",
      });
    },

    verifyAccessToken(token) {
      // `algorithms: ["HS256"]` is pinned explicitly rather than left to
      // jsonwebtoken's default (which would accept whatever algorithm the
      // token itself claims to use) — otherwise a token crafted with a
      // different algorithm the server also happens to trust could bypass
      // the intended verification. Issuer/audience are re-checked here too,
      // not just at signing time, so a token from a different context
      // can't be replayed against this one.
      const decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        issuer: ISSUER,
        audience: AUDIENCE,
      });

      // jwt.verify's return type is `string | JwtPayload`; a bare string
      // only happens when the token was signed with a raw string payload,
      // which signAccessToken above never does — this check exists for
      // TypeScript's benefit and as a defensive guard against a malformed
      // token that happens to still pass signature verification.
      if (typeof decoded === "string" || !decoded.sub || typeof decoded.email !== "string") {
        throw new Error("Access token payload is missing required claims");
      }

      return { sub: decoded.sub, email: decoded.email };
    },
  };
}
