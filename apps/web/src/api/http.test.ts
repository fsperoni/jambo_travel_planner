import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { apiFetch, ApiError, configureAuthHandlers } from "./http";

const TEST_URL = "http://localhost:3000/test-endpoint";

describe("apiFetch", () => {
  beforeEach(() => {
    // Reset to the "no auth" default before each test so a token configured
    // by one test can't leak into the next.
    configureAuthHandlers({ getAccessToken: () => null, onUnauthorized: () => {} });
  });

  it("attaches an Authorization: Bearer header when a token is available", async () => {
    let receivedAuthHeader: string | null = null;
    server.use(
      http.get(TEST_URL, ({ request }) => {
        receivedAuthHeader = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    configureAuthHandlers({ getAccessToken: () => "the-token", onUnauthorized: () => {} });

    await apiFetch("/test-endpoint");

    expect(receivedAuthHeader).toBe("Bearer the-token");
  });

  it("omits the Authorization header when there is no token", async () => {
    let receivedAuthHeader: string | null = "not-yet-set";
    server.use(
      http.get(TEST_URL, ({ request }) => {
        receivedAuthHeader = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiFetch("/test-endpoint");

    expect(receivedAuthHeader).toBeNull();
  });

  it("resolves with the parsed JSON body on success", async () => {
    server.use(http.get(TEST_URL, () => HttpResponse.json({ hello: "world" })));

    const result = await apiFetch<{ hello: string }>("/test-endpoint");

    expect(result).toEqual({ hello: "world" });
  });

  it("throws an ApiError carrying the code/message/details from a non-2xx response", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Bad input", details: ["x"] } },
          { status: 400 },
        ),
      ),
    );

    const error = (await apiFetch("/test-endpoint").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Bad input",
      details: ["x"],
    });
  });

  it("falls back to a generic error when the response body isn't the expected error shape", async () => {
    server.use(http.get(TEST_URL, () => new HttpResponse("not json", { status: 500 })));

    const error = (await apiFetch("/test-endpoint").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.code).toBe("UNKNOWN_ERROR");
  });

  it("calls onUnauthorized when a 401 comes back for a request that had a token attached", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json({ error: { code: "UNAUTHORIZED", message: "expired" } }, { status: 401 }),
      ),
    );
    let wasCalled = false;
    configureAuthHandlers({
      getAccessToken: () => "expired-token",
      onUnauthorized: () => {
        wasCalled = true;
      },
    });

    await apiFetch("/test-endpoint").catch(() => {});

    expect(wasCalled).toBe(true);
  });

  it("does NOT call onUnauthorized for a 401 when no token was attached", async () => {
    // A 401 with no token attached is a normal error for the caller to
    // handle (e.g. wrong login credentials) — not a session-expiry event.
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json({ error: { code: "UNAUTHORIZED", message: "invalid" } }, { status: 401 }),
      ),
    );
    let wasCalled = false;
    configureAuthHandlers({
      getAccessToken: () => null,
      onUnauthorized: () => {
        wasCalled = true;
      },
    });

    await apiFetch("/test-endpoint").catch(() => {});

    expect(wasCalled).toBe(false);
  });

  it("still throws the ApiError even when onUnauthorized also fires", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" } },
          { status: 401 },
        ),
      ),
    );
    configureAuthHandlers({ getAccessToken: () => "expired-token", onUnauthorized: () => {} });

    await expect(apiFetch("/test-endpoint")).rejects.toThrow("Invalid or expired access token");
  });
});
