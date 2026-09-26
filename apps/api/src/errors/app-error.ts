// A structured, HTTP-aware error. Thrown from anywhere in the request
// lifecycle (controllers, services, middleware); middleware/error-handler.ts
// is the only place that turns one into an HTTP response, so `code` stays a
// stable, machine-readable string the frontend can switch on instead of
// parsing `message` (which is free to change wording without breaking
// anything).
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request", details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
}

/**
 * A third-party API (Open-Meteo, Wikipedia, ipapi.co) timed out, was
 * unreachable, or returned an error status. `status` is *our* response
 * status (502 Bad Gateway for an unreachable/erroring upstream, 504
 * Gateway Timeout for one that took too long) — never the upstream's own
 * status code passed straight through, since that's an implementation
 * detail of a vendor we don't want leaking into our API's contract.
 */
export class UpstreamError extends AppError {
  constructor(status: 502 | 504, message: string, details?: unknown) {
    super(status, "UPSTREAM_ERROR", message, details);
  }
}
