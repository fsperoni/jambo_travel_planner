import rateLimit from "express-rate-limit";

/**
 * Limits login attempts per client IP. This is the only rate limiter in
 * the app — see the README's trade-offs section for why a general
 * API-wide limiter was deliberately left out.
 *
 * Correctness here depends on `req.ip` reflecting the real client, which
 * depends on Express's `trust proxy` setting matching the actual proxy
 * chain in front of the app. That's configured once verified against the
 * real hosting setup (Stage 6), not guessed at here — until then, every
 * request behind a proxy looks like it comes from the same IP, which only
 * makes this limiter overly strict (shared across all users), not unsafe.
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
