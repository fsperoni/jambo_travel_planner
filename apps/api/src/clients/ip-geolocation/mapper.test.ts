import { describe, expect, it } from "vitest";
import { mapIpApiResponse } from "./mapper.js";
import type { IpApiResponse } from "./raw-types.js";

describe("mapIpApiResponse", () => {
  it("maps a successful response to an IpLocation", () => {
    const raw: IpApiResponse = {
      city: "Calgary",
      region: "Alberta",
      country_code: "CA",
      latitude: 51.05,
      longitude: -114.07,
    };

    expect(mapIpApiResponse(raw)).toEqual({
      city: "Calgary",
      region: "Alberta",
      countryCode: "CA",
      latitude: 51.05,
      longitude: -114.07,
    });
  });

  it("maps a missing region to null rather than omitting the field", () => {
    const raw: IpApiResponse = {
      city: "Calgary",
      country_code: "CA",
      latitude: 51.05,
      longitude: -114.07,
    };

    expect(mapIpApiResponse(raw)?.region).toBeNull();
  });

  it("returns null for ipapi.co's own {error: true} body, regardless of reason", () => {
    // Confirmed live and against ipapi.co's docs: "Invalid IP Address" and
    // "Reserved IP Address" both come back as HTTP 200 with this shape —
    // the mapper has to read the body, not rely on fetchJson's HTTP-status
    // handling, to catch these.
    const reserved: IpApiResponse = { error: true, reason: "Reserved IP Address" };
    const invalid: IpApiResponse = { error: true, reason: "Invalid IP Address" };

    expect(mapIpApiResponse(reserved)).toBeNull();
    expect(mapIpApiResponse(invalid)).toBeNull();
  });

  it("returns null when a 'successful' response is missing the city", () => {
    const raw: IpApiResponse = {
      country_code: "CA",
      latitude: 51.05,
      longitude: -114.07,
    };

    expect(mapIpApiResponse(raw)).toBeNull();
  });

  it("returns null when a 'successful' response is missing coordinates", () => {
    const raw: IpApiResponse = { city: "Calgary", country_code: "CA" };

    expect(mapIpApiResponse(raw)).toBeNull();
  });
});
