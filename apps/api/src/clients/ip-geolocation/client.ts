import { fetchJson } from "../http.js";
import { mapIpApiResponse, type IpLocation } from "./mapper.js";
import type { IpApiResponse } from "./raw-types.js";

// ipapi.co is generally fast; matches the timeout budget used for the
// other two upstreams rather than inventing a different number without a
// reason to.
const REQUEST_TIMEOUT_MS = 5000;

export interface IpGeolocationClient {
  lookup(ip: string): Promise<IpLocation | null>;
}

/**
 * `baseUrl` is a constructor argument (from env.IP_GEOLOCATION_BASE_URL),
 * not a hardcoded literal — same reasoning as the other two clients:
 * integration tests point this at a local stub instead of the real API.
 */
export function createIpGeolocationClient(baseUrl: string): IpGeolocationClient {
  return {
    async lookup(ip) {
      const url = new URL(`/${encodeURIComponent(ip)}/json/`, baseUrl);

      // No notFoundReturnsNull here: ipapi.co has no 404 case for this
      // endpoint. A genuine outage/rate-limit still throws UpstreamError
      // (a 429, in practice — confirmed live) and is handled by
      // location.service.ts exactly like a mapped null: both fall back to
      // the default city, just with the same "lookup-failed" reason.
      const raw = await fetchJson<IpApiResponse>(url.toString(), {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      return mapIpApiResponse(raw);
    },
  };
}
