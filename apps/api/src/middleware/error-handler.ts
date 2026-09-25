import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../errors/app-error.js";

// Express recognizes an error-handling middleware purely by its four-
// parameter arity — the unused `_next` must stay, or Express treats this as
// a normal (non-error) handler and never calls it.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appError = toAppError(err);

  if (appError.status >= 500) {
    // Only 5xx is actually unexpected — log it with the original error for
    // debugging. 4xx (bad input, not found) is routine and not logged as a
    // failure.
    console.error(`[${appError.status}] ${appError.code}`, err);
  }

  // No stack traces or internal details ever reach the client — `message`
  // on AppError (and its subclasses) is written to be safe to expose.
  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
  });
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  // A ZodError reaching here means a route's own `schema.parse()` call
  // (inside middleware/validate.ts) rejected the request — that's a client
  // mistake, not a server bug, so it maps to 400 rather than falling
  // through to the generic 500 below.
  if (err instanceof ZodError) {
    return new ValidationError("Invalid request", err.issues);
  }
  return new AppError(500, "INTERNAL_ERROR", "Something went wrong");
}
