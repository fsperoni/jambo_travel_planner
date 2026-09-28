import { UpstreamError } from "../errors/app-error.js";

// Shared by every upstream client (Open-Meteo, Wikipedia, ipwho.is) — they're
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

// AbortSignal.timeout(ms) is specified to set its own `.reason` to a
// `DOMException` named "TimeoutError" the moment it fires, regardless of
// what's consuming the signal (fetch(), response.json(), anything else) or
// what shape that consumer's own rejection happens to take — confirmed
// directly against a real stalled response, not assumed: a server that
// sends headers and then never finishes the body makes `response.json()`
// reject on this runtime, but relying on *that* rejection's own `.name`
// alone would be relying on an implementation detail the spec doesn't
// guarantee for every consumer/engine. Checking the signal's own state is
// the primary, always-correct source of truth; the caught error's own
// `.name` is a fallback for a case the signal can't see — a caller (or a
// test) that hands a timeout-shaped rejection to `fetch` itself without
// the real signal ever having fired.
function isTimeoutAbort(signal: AbortSignal, err: unknown): boolean {
  if (signal.aborted && signal.reason instanceof Error && signal.reason.name === "TimeoutError") {
    return true;
  }
  return err instanceof Error && err.name === "TimeoutError";
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
 * APIs (Open-Meteo, Wikipedia, ipwho.is) — a distinct concern from the
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
  // Created once and kept in scope for the whole call, not just the
  // initial fetch() — a slow upstream can send headers promptly and then
  // stall the body, which is still a timeout, not a malformed response.
  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response;

  try {
    response = await fetch(url, { signal, headers });
  } catch (err) {
    if (isTimeoutAbort(signal, err)) {
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
  } catch (err) {
    // A body-read timeout and a genuinely malformed body both make
    // response.json() reject — checked here, not assumed, distinguished by
    // whether `signal` itself timed out, so a stalled body correctly
    // becomes a 504 like any other timeout, rather than being mislabeled
    // as the 502 a real syntax error (an HTML error page, an empty body
    // through a misconfigured proxy or CDN) produces.
    if (isTimeoutAbort(signal, err)) {
      throw new UpstreamError(504, `Upstream request to ${host} timed out`);
    }
    throw new UpstreamError(502, `Upstream ${host} returned an invalid JSON body`);
  }
}
