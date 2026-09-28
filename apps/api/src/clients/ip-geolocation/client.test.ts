import { afterEach, describe, expect, it, vi } from "vitest";
import { createIpGeolocationClient } from "./client.js";
import type { IpWhoIsResponse } from "./raw-types.js";

describe("ipwho.is client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests /{ip}, encoding an IPv6 address", async () => {
    const raw: IpWhoIsResponse = {
      success: true,
      city: "Calgary",
      region: "Alberta",
      country_code: "CA",
      latitude: 51.0447,
      longitude: -114.0719,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createIpGeolocationClient("https://ipwho.is");
    await client.lookup("2001:db8::1");

    const [requestUrl] = fetchMock.mock.calls[0] as [string];
    expect(requestUrl).toBe("https://ipwho.is/2001%3Adb8%3A%3A1");
  });

  it("maps a successful response through the real mapper into an IpLocation", async () => {
    const raw: IpWhoIsResponse = {
      success: true,
      city: "Calgary",
      region: "Alberta",
      country_code: "CA",
      latitude: 51.0447,
      longitude: -114.0719,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 })),
    );

    const client = createIpGeolocationClient("https://ipwho.is");
    const result = await client.lookup("1.2.3.4");

    expect(result).toEqual({
      city: "Calgary",
      region: "Alberta",
      countryCode: "CA",
      latitude: 51.0447,
      longitude: -114.0719,
    });
  });

  it("maps ipwho.is's {success: false} body to null rather than throwing", async () => {
    const raw: IpWhoIsResponse = { success: false, message: "Reserved range" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 })),
    );

    const client = createIpGeolocationClient("https://ipwho.is");
    const result = await client.lookup("10.0.0.1");

    expect(result).toBeNull();
  });
});
