import { fetchJson, UPSTREAM_TIMEOUT_MS } from "../http.js";
import { mapIpWhoIsResponse, type IpLocation } from "./mapper.js";
import type { IpWhoIsResponse } from "./raw-types.js";

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
      const url = new URL(`/${encodeURIComponent(ip)}`, baseUrl);

      // No notFoundReturnsNull here: this app only ever calls lookup()
      // with a real IP address (from req.ip), and ipwho.is's known
      // "couldn't do this" case for that input (a reserved/private range)
      // comes back as a 200 with {success: false} — read by the mapper,
      // not the HTTP status. A genuine outage/rate-limit still throws
      // UpstreamError and is handled by location.service.ts exactly like
      // a mapped null: both fall back to the default city, just with the
      // same "lookup-failed" reason.
      const raw = await fetchJson<IpWhoIsResponse>(url.toString(), {
        timeoutMs: UPSTREAM_TIMEOUT_MS,
      });

      return mapIpWhoIsResponse(raw);
    },
  };
}
