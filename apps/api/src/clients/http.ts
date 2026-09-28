import { UpstreamError } from "../errors/app-error.js";

// Shared by every upstream client (Open-Meteo, Wikipedia, ipapi.co) — they're
// all comfortably fast in practice, and none has shown a reason to need a
// different budget from the others, so one constant avoids three copies of
// the same number silently drifting apart.
export const UPSTREAM_TIMEOUT_MS = 5000;

export interface FetchJsonOptions {
  timeoutMs: number;
  headers?: Record<string, string>;
  /** When true, a 404 response resolves to `null` instead of throwing —
   *  for endpoints where "not found" is a normal, expected outcome (a
   *  Wikipedia page that doesn't exist) rather than an upstream failure.
   *  Left `false`/unset for callers like the weather client, where a 404
   *  really would mean something's wrong, not that there's nothing there. */
  notFoundReturnsNull?: boolean;
}

// Overloads so the *return type* reflects whether a caller opted into
// notFoundReturnsNull, rather than every caller — including ones that never
// set it — having to handle a `T | null` they can never actually receive.
export function fetchJson<T>(
  url: string,
  options: FetchJsonOptions & { notFoundReturnsNull: true },
): Promise<T | null>;
export function fetchJson<T>(
  url: string,
  options: FetchJsonOptions & { notFoundReturnsNull?: false },
): Promise<T>;

/**
 * A small wrapper around native `fetch` for calling EXTERNAL third-party
 * APIs (Open-Meteo, Wikipedia, ipapi.co) — a distinct concern from the
 * frontend's own `api/http.ts`, which calls *this* backend, not a vendor.
 * Every external call gets an explicit timeout (native fetch has none by
 * default), and any failure becomes a structured `UpstreamError` this API
 * can return as a clean 502/504, rather than an unhandled hang or a raw
 * `TypeError`/`DOMException` leaking a vendor's own error shape.
 */
export async function fetchJson<T>(
  url: string,
  { timeoutMs, headers, notFoundReturnsNull }: FetchJsonOptions,
): Promise<T | null> {
  const host = new URL(url).hostname;
  let response: Response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers });
  } catch (err) {
    // AbortSignal.timeout() rejects with a DOMException named "TimeoutError"
    // specifically — distinguishing that from any other network failure
    // (DNS, connection refused, TLS) is what tells us whether to report a
    // slow upstream (504) or an unreachable one (502).
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new UpstreamError(504, `Upstream request to ${host} timed out`);
    }
    throw new UpstreamError(
      502,
      `Upstream request to ${host} failed`,
      err instanceof Error ? err.message : undefined,
    );
  }

  if (notFoundReturnsNull && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new UpstreamError(502, `Upstream ${host} responded with status ${response.status}`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    // A 2xx status doesn't guarantee a JSON body — an upstream can return
    // an HTML error page or an empty body through a misconfigured proxy or
    // CDN. Without this, `response.json()`'s SyntaxError would propagate
    // uncaught, and the central error handler would map it to a generic
    // 500 instead of the 502 every other upstream failure here produces.
    throw new UpstreamError(502, `Upstream ${host} returned an invalid JSON body`);
  }
}
