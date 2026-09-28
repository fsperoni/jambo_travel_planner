import type { IpWhoIsResponse } from "./raw-types.js";

export interface IpLocation {
  city: string;
  region: string | null;
  countryCode: string;
  latitude: number;
  longitude: number;
}

/**
 * `null` covers every "couldn't determine a location" outcome as one
 * outcome, deliberately not distinguished further here: ipwho.is's own
 * `{success: false}` body (reserved/private IP, or any other reason it
 * might give), and a "successful" response that's simply missing a field
 * this app needs. `services/location.service.ts` treats all of these
 * identically — fall back to the default city — so there's no caller that
 * would do anything different with a more specific reason, the same
 * reasoning as Wikipedia's disambiguation/404 collapsing to one `null` in
 * clients/wikipedia/mapper.ts.
 */
export function mapIpWhoIsResponse(raw: IpWhoIsResponse): IpLocation | null {
  if (!raw.success) {
    return null;
  }

  if (!raw.city || !raw.country_code || raw.latitude == null || raw.longitude == null) {
    return null;
  }

  return {
    city: raw.city,
    region: raw.region ?? null,
    countryCode: raw.country_code,
    latitude: raw.latitude,
    longitude: raw.longitude,
  };
}
