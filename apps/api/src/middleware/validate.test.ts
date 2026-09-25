import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";
import { validate } from "./validate.js";

function fakeRequest(overrides: Partial<Request> = {}): Request {
  return { body: {}, query: {}, params: {}, ...overrides } as Request;
}

describe("validate", () => {
  it("parses body and query, exposing the result on req.valid", () => {
    const middleware = validate({
      body: z.object({ email: z.string() }),
      query: z.object({ page: z.coerce.number().default(1) }),
    });
    const req = fakeRequest({ body: { email: "a@b.com" }, query: {} });
    const next = vi.fn();

    middleware(req, {} as Response, next as NextFunction);

    // Called with no error argument: validation succeeded.
    expect(next).toHaveBeenCalledWith();
    expect(req.valid).toEqual({ body: { email: "a@b.com" }, query: { page: 1 } });
  });

  it("forwards a ZodError to next() on invalid input, without setting req.valid", () => {
    const middleware = validate({ body: z.object({ email: z.email() }) });
    const req = fakeRequest({ body: { email: "not-an-email" } });
    const next = vi.fn();

    middleware(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const [err] = next.mock.calls[0] as [unknown];
    expect(err).toBeInstanceOf(ZodError);
    expect(req.valid).toBeUndefined();
  });

  it("only populates the parts of req.valid a schema was given for", () => {
    const middleware = validate({ body: z.object({}) });
    const req = fakeRequest({ params: { id: "abc" } });

    middleware(req, {} as Response, vi.fn() as NextFunction);

    expect(req.valid).toEqual({ body: {} });
  });
});
