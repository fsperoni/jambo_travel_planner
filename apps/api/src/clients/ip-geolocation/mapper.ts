import type { IpApiResponse } from "./raw-types.js";

export interface IpLocation {
  city: string;
  region: string | null;
  countryCode: string;
  latitude: number;
  longitude: number;
}

/**
 * `null` covers every "couldn't determine a location" outcome as one
 * outcome, deliberately not distinguished further here: ipapi.co's own
 * {error: true} body (reserved/invalid IP, or any other reason string it
 * might use), and a "successful" response that's simply missing the
 * fields this app actually needs. `services/location.service.ts` treats
 * all of these identically — fall back to the default city — so there's
 * no caller that would do anything different with a more specific reason,
 * the same reasoning as Wikipedia's disambiguation/404 collapsing to one
 * `null` in clients/wikipedia/mapper.ts.
 */
export function mapIpApiResponse(raw: IpApiResponse): IpLocation | null {
  // IpApiErrorResponse.error is always literally `true` (never `false`) —
  // checking its presence alone is enough to discriminate the union, and
  // lets TypeScript narrow `raw` to IpApiSuccessResponse below.
  if ("error" in raw) {
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
