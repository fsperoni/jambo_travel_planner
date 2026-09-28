import rateLimit from "express-rate-limit";

/**
 * Limits login attempts per client IP. This is the only rate limiter in
 * the app — see the README's trade-offs section for why a general
 * API-wide limiter was deliberately left out.
 *
 * Correctness here depends on `req.ip` reflecting the real client, which
 * depends on Express's `trust proxy` setting (config/env.ts's
 * TRUST_PROXY_HOPS) matching the actual proxy chain in front of the app —
 * confirmed against the real Render deployment (hops=1), not just assumed.
 * Getting that number wrong doesn't fail safe in either direction: too few
 * trusted hops makes every request behind the proxy look like it comes
 * from the same IP, merging unrelated users into one shared limit (overly
 * strict, but not a security hole); too many trusts a client-supplied
 * `X-Forwarded-For` value the client fully controls, letting an attacker
 * claim a fresh IP on every request and bypass the limit entirely (a real
 * spoofing vector, not merely inconvenient) — see the README's IP-based
 * geolocation section for the same setting explained in more depth.
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts. Try again later.",
    },
  },
});
