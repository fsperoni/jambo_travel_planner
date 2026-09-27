import { describe, expect, it, vi } from "vitest";
import type { IpGeolocationClient } from "../clients/ip-geolocation/client.js";
import type { City } from "../domain/city-catalogue.js";
import { createLocationService } from "./location.service.js";

const DEFAULT_CITY: City = {
  id: "calgary",
  name: "Calgary",
  countryCode: "CA",
  latitude: 51.05,
  longitude: -114.07,
  wikipediaTitle: "Calgary",
};

function buildService(lookup: IpGeolocationClient["lookup"]) {
  const ipGeolocationClient: IpGeolocationClient = { lookup };
  return createLocationService({ ipGeolocationClient, defaultCity: DEFAULT_CITY });
}

describe("locationService.detectLocation", () => {
  it("returns the default city with reason 'local-development' for a loopback IP, without calling the provider", async () => {
    const lookup = vi.fn();
    const service = buildService(lookup);

    const result = await service.detectLocation("127.0.0.1");

    expect(result).toEqual({ city: DEFAULT_CITY, source: "default", reason: "local-development" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("normalizes an IPv4-mapped loopback address before checking it", async () => {
    const lookup = vi.fn();
    const service = buildService(lookup);

    const result = await service.detectLocation("::ffff:127.0.0.1");

    expect(result.source).toBe("default");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("returns the default city with reason 'lookup-failed' when the provider throws", async () => {
    const service = buildService(vi.fn().mockRejectedValue(new Error("upstream down")));

    const result = await service.detectLocation("203.0.113.5");

    expect(result).toEqual({ city: DEFAULT_CITY, source: "default", reason: "lookup-failed" });
  });

  it("returns the default city with reason 'lookup-failed' when the provider returns null", async () => {
    const service = buildService(vi.fn().mockResolvedValue(null));

    const result = await service.detectLocation("203.0.113.5");

    expect(result).toEqual({ city: DEFAULT_CITY, source: "default", reason: "lookup-failed" });
  });

  it("matches the catalogue on name and country, ignoring diacritics", async () => {
    const service = buildService(
      vi.fn().mockResolvedValue({
        city: "Sao Paulo",
        region: "São Paulo",
        countryCode: "BR",
        latitude: -23.55,
        longitude: -46.63,
      }),
    );

    const result = await service.detectLocation("203.0.113.5");

    expect(result.source).toBe("ip");
    expect(result.city.id).toBe("sao-paulo");
    expect(result.reason).toBeUndefined();
  });

  it("returns a dynamic 'detected' city when the provider's city isn't in the catalogue", async () => {
    const service = buildService(
      vi.fn().mockResolvedValue({
        city: "Okotoks",
        region: "Alberta",
        countryCode: "CA",
        latitude: 50.73,
        longitude: -113.98,
      }),
    );

    const result = await service.detectLocation("203.0.113.5");

    expect(result).toEqual({
      city: {
        id: "detected",
        name: "Okotoks",
        region: "Alberta",
        countryCode: "CA",
        latitude: 50.73,
        longitude: -113.98,
        wikipediaTitle: "Okotoks",
      },
      source: "ip",
    });
  });
});
