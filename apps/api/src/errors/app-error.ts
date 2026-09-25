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
