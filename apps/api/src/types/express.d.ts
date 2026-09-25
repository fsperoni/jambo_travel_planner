// Express 5 made `req.query` a read-only accessor (no setter), so
// middleware/validate.ts can no longer replace it with the parsed/coerced
// Zod output the way it can for `req.body` and `req.params`. Rather than
// special-case query differently from body and params — mutating two of
// three in place and stashing the third somewhere else — validated input
// for all three always goes through this one `req.valid` property, so
// controllers have a single, predictable place to read it from regardless
// of which part of the request it came from.
export {};

declare global {
  namespace Express {
    interface Request {
      valid?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}
