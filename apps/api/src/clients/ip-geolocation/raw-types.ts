// ipwho.is's shape, confirmed against its own published documentation
// (https://ipwhois.io/documentation) and cross-checked against real live
// responses: a successful lookup (`curl https://ipwho.is/8.8.8.8`) and a
// reserved-range one (`curl https://ipwho.is/10.0.0.1` →
// `{"success":false,"message":"Reserved range"}`, HTTP 200 — the provider's
// own "couldn't do this" response is data, not necessarily a non-2xx
// status, the same pattern already handled for the previous provider (see
// mapper.ts). Only the fields this app actually reads are declared.
export interface IpWhoIsSuccessResponse {
  success: true;
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Confirmed live: a reserved/private IP comes back as HTTP 200 with
 * `success: false` and a `message` explaining why (e.g. "Reserved range").
 * A genuinely malformed lookup path returns a real HTTP 404 instead (not
 * modeled here — this app only ever calls `lookup()` with a real IP
 * address, from `req.ip`, so that path isn't a normal case to design
 * around; a non-2xx response is still handled by `fetchJson` as an
 * `UpstreamError`, which `location.service.ts` treats identically to a
 * mapped `null` either way).
 */
export interface IpWhoIsErrorResponse {
  success: false;
  message?: string;
}

export type IpWhoIsResponse = IpWhoIsSuccessResponse | IpWhoIsErrorResponse;
