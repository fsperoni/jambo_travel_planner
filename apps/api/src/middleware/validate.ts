import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Parses `req.body` / `req.query` / `req.params` against the given Zod
 * schemas and, on success, exposes the parsed result (defaults applied,
 * strings coerced, unknown keys stripped) via `req.valid` for the route's
 * controller to read. On failure, forwards the ZodError to `next()`, where
 * the central error handler maps it to a 400.
 *
 * Controllers cast the relevant part of `req.valid` to its expected type,
 * e.g. `req.valid!.query as WeatherQuery`. Express's types don't let a
 * middleware factory like this narrow the specific route's `Request` type,
 * so a single explicit cast at the point of use is the pragmatic trade-off
 * here rather than adding a typed-router abstraction for a project this
 * size.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const valid: NonNullable<Request["valid"]> = {};
      if (schemas.body) valid.body = schemas.body.parse(req.body);
      if (schemas.query) valid.query = schemas.query.parse(req.query);
      if (schemas.params) valid.params = schemas.params.parse(req.params);
      req.valid = valid;
      next();
    } catch (err) {
      next(err);
    }
  };
}
