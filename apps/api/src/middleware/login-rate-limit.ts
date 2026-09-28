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
 * If that number were ever wrong, this limiter would fail safe: every
 * request behind the proxy would look like it comes from the same IP,
 * making it overly strict (shared across all users) rather than unsafe.
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
