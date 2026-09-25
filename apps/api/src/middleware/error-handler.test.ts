import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { z } from "zod";
import { errorHandler } from "./error-handler.js";
import { NotFoundError, ValidationError } from "../errors/app-error.js";

function fakeResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("errorHandler", () => {
  it("maps a NotFoundError to a 404 with the standard error envelope", () => {
    const res = fakeResponse();

    errorHandler(new NotFoundError("no route"), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "NOT_FOUND", message: "no route" },
    });
  });

  it("maps a ZodError to a 400 VALIDATION_ERROR carrying the issue details", () => {
    const res = fakeResponse();
    const schema = z.object({ email: z.email() });
    const result = schema.safeParse({ email: "not-an-email" });
    if (result.success) throw new Error("expected this parse to fail");

    errorHandler(result.error, {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: result.error.issues,
      },
    });
  });

  it("maps an unrecognized error to a generic 500 without leaking internals", () => {
    const res = fakeResponse();

    errorHandler(
      new Error("connection failed: postgres://user:hunter2@db.internal/jambo"),
      {} as Request,
      res,
      vi.fn(),
    );

    // The client sees a generic message — no stack trace, no connection
    // string, no indication of what actually failed internally.
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });

  it("includes AppError.details when the error carries them", () => {
    const res = fakeResponse();

    errorHandler(
      new ValidationError("date out of range", { min: "2026-09-24", max: "2026-09-29" }),
      {} as Request,
      res,
      vi.fn(),
    );

    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "VALIDATION_ERROR",
        message: "date out of range",
        details: { min: "2026-09-24", max: "2026-09-29" },
      },
    });
  });
});
