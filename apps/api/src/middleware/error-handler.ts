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
  // express.json() (app.ts) throws its own errors for a malformed body or
  // one over the configured size limit — both real client mistakes, not
  // server bugs, that were previously falling all the way through to the
  // generic 500 below (confirmed against a real request with each: a
  // literal "{not json" body, and one over the 10kb limit). Matched by the
  // error's own `.type` string (a stable identifier from body-parser/
  // raw-body, confirmed directly against the installed Express version,
  // not from documentation alone) rather than trusting its `.status` —
  // this function decides the status itself, from a fixed, known set of
  // types, so an arbitrary object with a spoofed `.status` couldn't
  // influence the response either way. No dedicated AppError subclass:
  // unlike ValidationError or UnauthorizedError, nothing in this codebase
  // ever constructs one of these — they only ever originate from
  // express.json() itself, so there's nothing to import the class for.
  const bodyParserErrorType = getBodyParserErrorType(err);
  if (bodyParserErrorType === "entity.parse.failed") {
    return new AppError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
  if (bodyParserErrorType === "entity.too.large") {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  return new AppError(500, "INTERNAL_ERROR", "Something went wrong");
}

function getBodyParserErrorType(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("type" in err)) return undefined;
  const { type } = err as { type: unknown };
  return typeof type === "string" ? type : undefined;
}
