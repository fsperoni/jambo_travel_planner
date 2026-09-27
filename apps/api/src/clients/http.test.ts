import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./http.js";

// fetch itself is stubbed (rather than standing up a real HTTP server, or
// pulling in a request-mocking library) — consistent with how the rest of
// this backend's unit tests inject a fake collaborator instead of
// intercepting network traffic; that style is reserved for the frontend
// (MSW), which has a real browser-fetch boundary to simulate.
describe("fetchJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed JSON body on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ hello: "world" }), { status: 200 })),
    );

    const result = await fetchJson<{ hello: string }>("https://example.com/data", {
      timeoutMs: 1000,
    });

    expect(result).toEqual({ hello: "world" });
  });

  it("throws a 502 UpstreamError when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    await expect(fetchJson("https://example.com/data", { timeoutMs: 1000 })).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_ERROR",
    });
  });

  it("throws a 504 UpstreamError when the request times out", async () => {
    // This is exactly the error AbortSignal.timeout() itself rejects with —
    // confirmed against the real fetch implementation, not assumed.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new DOMException("The operation was aborted due to timeout", "TimeoutError"),
        ),
    );

    await expect(fetchJson("https://example.com/data", { timeoutMs: 1000 })).rejects.toMatchObject({
      status: 504,
      code: "UPSTREAM_ERROR",
    });
  });

  it("throws a 502 UpstreamError for a network-level failure (DNS, connection refused, etc.)", async () => {
    // This is the error shape a genuine connection failure produces —
    // also confirmed against the real fetch implementation.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(fetchJson("https://example.com/data", { timeoutMs: 1000 })).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_ERROR",
    });
  });

  it("names the failing host in the error message, not just the status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

    await expect(
      fetchJson("https://api.open-meteo.com/v1/forecast", { timeoutMs: 1000 }),
    ).rejects.toThrow(/api\.open-meteo\.com/);
  });

  it("passes custom headers through to fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJson("https://en.wikipedia.org/api/rest_v1/page/summary/Calgary", {
      timeoutMs: 1000,
      headers: { "User-Agent": "JamboTravelPlanner/0.1 (test)" },
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).toEqual({ "User-Agent": "JamboTravelPlanner/0.1 (test)" });
  });

  it("returns null for a 404 when notFoundReturnsNull is set, instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    const result = await fetchJson("https://en.wikipedia.org/api/rest_v1/page/summary/NotReal", {
      timeoutMs: 1000,
      notFoundReturnsNull: true,
    });

    expect(result).toBeNull();
  });

  it("still throws for a non-404 failure even with notFoundReturnsNull set", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    await expect(
      fetchJson("https://en.wikipedia.org/api/rest_v1/page/summary/Calgary", {
        timeoutMs: 1000,
        notFoundReturnsNull: true,
      }),
    ).rejects.toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
  });

  it("still throws (rather than returning null) for a 404 when notFoundReturnsNull is not set", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    await expect(fetchJson("https://example.com/data", { timeoutMs: 1000 })).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_ERROR",
    });
  });
});
