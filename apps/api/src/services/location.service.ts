import type { IpGeolocationClient } from "../clients/ip-geolocation/client.js";
import type { City } from "../domain/city-catalogue.js";
import { findCityByNameAndCountry } from "../domain/city-catalogue.js";
import { isLoopback, normalizeIp } from "../domain/client-ip.js";

export interface DetectedLocation {
  city: City;
  source: "ip" | "default";
  /** Present only when `source` is "default" — why detection didn't run
   *  (a loopback/local-dev request) or didn't produce a usable result
   *  (the provider failed, was rate-limited, or had nothing for this IP). */
  reason?: "local-development" | "lookup-failed";
}

export interface LocationService {
  detectLocation(rawIp: string | undefined): Promise<DetectedLocation>;
}

export interface LocationServiceDependencies {
  ipGeolocationClient: IpGeolocationClient;
  /** Resolved once at startup from env.DEFAULT_CITY_ID (config/env.ts
   *  fails fast if that id isn't in the catalogue), so this service never
   *  has to handle a missing default city as a runtime case. */
  defaultCity: City;
}

/**
 * Every failure mode this depends on — a loopback IP, a provider outage,
 * a rate limit, an IP the provider won't or can't geolocate — collapses to
 * the same outcome: fall back to the default city. None of them are
 * surfaced as an HTTP error; a wrong or missing "detected" city is a
 * degraded experience, not a broken one, and the whole point of an
 * IP-detected default is that the app must still work when detection
 * doesn't.
 */
export function createLocationService({
  ipGeolocationClient,
  defaultCity,
}: LocationServiceDependencies): LocationService {
  // Every fallback path returns the same shape, differing only in `reason`
  // — a small helper instead of repeating the object literal at each of
  // the three call sites below.
  function fallback(reason: NonNullable<DetectedLocation["reason"]>): DetectedLocation {
    return { city: defaultCity, source: "default", reason };
  }

  return {
    async detectLocation(rawIp) {
      // Express types req.ip as possibly undefined (the underlying
      // socket's remoteAddress can genuinely be missing, e.g. if the
      // connection was already torn down) — treated the same as a
      // provider that couldn't produce a usable result, since there's
      // nothing to geolocate either way.
      if (rawIp === undefined) {
        return fallback("lookup-failed");
      }

      const ip = normalizeIp(rawIp);

      if (isLoopback(ip)) {
        return fallback("local-development");
      }

      let location: Awaited<ReturnType<IpGeolocationClient["lookup"]>>;
      try {
        location = await ipGeolocationClient.lookup(ip);
      } catch (err) {
        // A real provider outage, timeout, or rate limit. Logged without
        // the IP itself — see the README's privacy note — and with
        // console.warn rather than console.error, since this is an
        // expected, already-handled failure mode, not the kind of bug
        // middleware/error-handler.ts's 5xx logging exists to flag.
        console.warn(
          "IP geolocation lookup failed:",
          err instanceof Error ? err.message : "unknown error",
        );
        return fallback("lookup-failed");
      }

      if (!location) {
        return fallback("lookup-failed");
      }

      const matched = findCityByNameAndCountry(location.city, location.countryCode);
      if (matched) {
        return { city: matched, source: "ip" };
      }

      // Not in the catalogue — a real, resolvable location the frontend
      // inserts as a one-off entry at the top of the dropdown, rather than
      // forcing every detected city to already be one of the ~10 curated
      // ones. wikipediaTitle is a best-effort guess (the provider's own
      // city name); if it doesn't resolve to a real article, the
      // description feature already treats that as a normal empty state,
      // not an error — see clients/wikipedia/.
      return {
        city: {
          id: "detected",
          name: location.city,
          region: location.region ?? undefined,
          countryCode: location.countryCode,
          latitude: location.latitude,
          longitude: location.longitude,
          wikipediaTitle: location.city,
        },
        source: "ip",
      };
    },
  };
}
