import { afterEach, describe, expect, it, vi } from "vitest";
import { createWikipediaClient } from "./client.js";
import type { WikipediaSummaryResponse } from "./raw-types.js";

describe("Wikipedia client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("encodes the title and requests the summary endpoint", async () => {
    const raw: WikipediaSummaryResponse = {
      title: "São Paulo",
      type: "standard",
      extract: "São Paulo is a city in Brazil.",
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/S%C3%A3o_Paulo" } },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createWikipediaClient("https://en.wikipedia.org", "JamboTravelPlanner/test");
    await client.getSummary("São Paulo");

    const [requestUrl] = fetchMock.mock.calls[0] as [string];
    // encodeURIComponent handles the non-ASCII character — confirmed here
    // rather than assumed from reading the client's source.
    expect(requestUrl).toBe("https://en.wikipedia.org/api/rest_v1/page/summary/S%C3%A3o%20Paulo");
  });

  it("sends the configured User-Agent and an Accept header, as Wikimedia's API requires", async () => {
    const raw: WikipediaSummaryResponse = { title: "Calgary", type: "standard" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createWikipediaClient("https://en.wikipedia.org", "JamboTravelPlanner/test");
    await client.getSummary("Calgary");

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).toEqual({
      "User-Agent": "JamboTravelPlanner/test",
      Accept: "application/json",
    });
  });

  it("maps the response through the real mapper into a CityDescription", async () => {
    const raw: WikipediaSummaryResponse = {
      title: "Calgary",
      type: "standard",
      extract: "Calgary is a city in Alberta, Canada.",
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Calgary" } },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 })),
    );

    const client = createWikipediaClient("https://en.wikipedia.org", "JamboTravelPlanner/test");
    const result = await client.getSummary("Calgary");

    expect(result).toEqual({
      title: "Calgary",
      description: "Calgary is a city in Alberta, Canada.",
      sourceUrl: "https://en.wikipedia.org/wiki/Calgary",
    });
  });

  it("resolves to a null description for a 404 rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    const client = createWikipediaClient("https://en.wikipedia.org", "JamboTravelPlanner/test");
    const result = await client.getSummary("NotARealTitle");

    expect(result).toEqual({ title: "NotARealTitle", description: null, sourceUrl: null });
  });
});
