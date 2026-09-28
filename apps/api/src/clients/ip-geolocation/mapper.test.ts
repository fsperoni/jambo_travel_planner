import { describe, expect, it } from "vitest";
import { mapIpWhoIsResponse } from "./mapper.js";
import type { IpWhoIsResponse } from "./raw-types.js";

describe("mapIpWhoIsResponse", () => {
  it("maps a successful response to an IpLocation", () => {
    const raw: IpWhoIsResponse = {
      success: true,
      city: "Calgary",
      region: "Alberta",
      country_code: "CA",
      latitude: 51.05,
      longitude: -114.07,
    };

    expect(mapIpWhoIsResponse(raw)).toEqual({
      city: "Calgary",
      region: "Alberta",
      countryCode: "CA",
      latitude: 51.05,
      longitude: -114.07,
    });
  });

  it("maps a missing region to null rather than omitting the field", () => {
    const raw: IpWhoIsResponse = {
      success: true,
      city: "Calgary",
      country_code: "CA",
      latitude: 51.05,
      longitude: -114.07,
    };

    expect(mapIpWhoIsResponse(raw)?.region).toBeNull();
  });

  it("returns null for ipwho.is's own {success: false} body, regardless of message", () => {
    // Confirmed live: a reserved/private IP (e.g. 10.0.0.1) comes back as
    // HTTP 200 with this shape — the mapper has to read the body, not rely
    // on fetchJson's HTTP-status handling, to catch this.
    const reserved: IpWhoIsResponse = { success: false, message: "Reserved range" };
    const rateLimited: IpWhoIsResponse = { success: false, message: "Rate limit exceeded" };

    expect(mapIpWhoIsResponse(reserved)).toBeNull();
    expect(mapIpWhoIsResponse(rateLimited)).toBeNull();
  });

  it("returns null when a 'successful' response is missing the city", () => {
    const raw: IpWhoIsResponse = {
      success: true,
      country_code: "CA",
      latitude: 51.05,
      longitude: -114.07,
    };

    expect(mapIpWhoIsResponse(raw)).toBeNull();
  });

  it("returns null when a 'successful' response is missing coordinates", () => {
    const raw: IpWhoIsResponse = { success: true, city: "Calgary", country_code: "CA" };

    expect(mapIpWhoIsResponse(raw)).toBeNull();
  });
});
