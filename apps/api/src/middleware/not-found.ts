import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../errors/app-error.js";

// Mounted after every real route. Converts the "nothing matched" fall-through
// into the same AppError shape every other 4xx/5xx goes through, so
// error-handler.ts is the one place that formats API error responses.
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`No route for ${req.method} ${req.path}`));
}
