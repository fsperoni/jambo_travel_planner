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

  it("maps express.json()'s malformed-body error to a 400 INVALID_JSON, not a 500", () => {
    const res = fakeResponse();
    // The exact shape express.json() (body-parser under the hood) throws
    // for "{not json" — confirmed against a real request through the
    // actual installed Express version, not assumed from documentation.
    const bodyParserError = Object.assign(new SyntaxError("Unexpected token o"), {
      status: 400,
      type: "entity.parse.failed",
    });

    errorHandler(bodyParserError, {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
  });

  it("maps express.json()'s body-too-large error to a 413 PAYLOAD_TOO_LARGE, not a 500", () => {
    const res = fakeResponse();
    // The exact shape express.json() throws for a body over its configured
    // limit — confirmed the same way as the malformed-body case above.
    const bodyParserError = Object.assign(new Error("request entity too large"), {
      status: 413,
      type: "entity.too.large",
    });

    errorHandler(bodyParserError, {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" },
    });
  });

  it("does not trust an arbitrary error's own .status — an unrecognized .type still maps to a generic 500", () => {
    const res = fakeResponse();
    // An object shaped to *look* like a body-parser error, with a status
    // that would be wrong to trust blindly, but a .type this function
    // doesn't recognize — must not influence the response.
    const spoofedError = Object.assign(new Error("not a real body-parser error"), {
      status: 418,
      type: "something.else",
    });

    errorHandler(spoofedError, {} as Request, res, vi.fn());

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
