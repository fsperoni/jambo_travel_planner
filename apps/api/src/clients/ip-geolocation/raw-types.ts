// ipapi.co's shape, confirmed against its own published documentation
// (https://ipapi.co/api/) and cross-checked against a real rate-limited
// response captured live (same {error, reason, message} shape the docs
// describe) — see AI_USAGE.md for why the success shape itself couldn't
// be captured live: ipapi.co's free tier was already exhausted from both
// the development sandbox and a residential network when this was built.
//
// A successful lookup has no `error` field at all. Only the fields this
// app actually reads are declared.
export interface IpApiSuccessResponse {
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Confirmed live: a plain non-2xx failure (RateLimited) comes back as
 * HTTP 429 with this shape. Per ipapi.co's own docs, "Invalid IP Address"
 * and "Reserved IP Address" use this *same* shape but with an HTTP 200 —
 * an unusual pattern that means detecting those cases requires reading the
 * response body, not just the HTTP status (see mapper.ts).
 */
export interface IpApiErrorResponse {
  error: true;
  reason: string;
  message?: string;
}

export type IpApiResponse = IpApiSuccessResponse | IpApiErrorResponse;
