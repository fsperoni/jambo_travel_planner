import { UpstreamError } from "../errors/app-error.js";

export interface FetchJsonOptions {
  timeoutMs: number;
}

/**
 * A small wrapper around native `fetch` for calling EXTERNAL third-party
 * APIs (Open-Meteo, Wikipedia, ipapi.co) — a distinct concern from the
 * frontend's own `api/http.ts`, which calls *this* backend, not a vendor.
 * Every external call gets an explicit timeout (native fetch has none by
 * default), and any failure becomes a structured `UpstreamError` this API
 * can return as a clean 502/504, rather than an unhandled hang or a raw
 * `TypeError`/`DOMException` leaking a vendor's own error shape.
 */
export async function fetchJson<T>(url: string, { timeoutMs }: FetchJsonOptions): Promise<T> {
  const host = new URL(url).hostname;
  let response: Response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
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

  if (!response.ok) {
    throw new UpstreamError(502, `Upstream ${host} responded with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
