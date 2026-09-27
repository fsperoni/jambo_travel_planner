import { describe, expect, it } from "vitest";
import { mapSummaryResponse } from "./mapper.js";
import type { WikipediaSummaryResponse } from "./raw-types.js";

describe("mapSummaryResponse", () => {
  it("maps a standard article to a description and source URL", () => {
    // Based on a real response captured from en.wikipedia.org for Calgary,
    // not written from documentation alone.
    const raw: WikipediaSummaryResponse = {
      type: "standard",
      title: "Calgary",
      extract:
        "Calgary is the largest city in the Canadian province of Alberta. As of 2021, the city proper had a population of 1,306,784 and a metropolitan population of 1,481,806, making Calgary the third-largest city and the fifth-largest metropolitan area in Canada.",
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Calgary" } },
    };

    const result = mapSummaryResponse("Calgary", raw);

    expect(result).toEqual({
      title: "Calgary",
      description: raw.extract,
      sourceUrl: "https://en.wikipedia.org/wiki/Calgary",
    });
  });

  it("uses Wikipedia's own canonical title, not necessarily the requested one", () => {
    const raw: WikipediaSummaryResponse = {
      type: "standard",
      title: "New York City",
      extract: "New York, often called New York City (NYC), is the most populous city.",
    };

    const result = mapSummaryResponse("nyc", raw);

    expect(result.title).toBe("New York City");
  });

  it("truncates a long extract to a short description", () => {
    // Real extracts vary a lot in length (New York City's real one was 854
    // characters) — this fixture doesn't need to be that long to prove the
    // truncation actually runs; truncate-text.test.ts already covers the
    // exact truncation behaviour in isolation.
    const longExtract = "A ".repeat(200).trim();
    const raw: WikipediaSummaryResponse = {
      type: "standard",
      title: "Somewhere",
      extract: longExtract,
    };

    const result = mapSummaryResponse("Somewhere", raw);

    expect(result.description?.length).toBeLessThan(longExtract.length);
    expect(result.description?.endsWith("…")).toBe(true);
  });

  it("returns description: null and sourceUrl: null for a disambiguation page", () => {
    // Based on a real disambiguation response (en.wikipedia.org/.../Mercury).
    const raw: WikipediaSummaryResponse = {
      type: "disambiguation",
      title: "Mercury",
      extract: "Mercury most commonly refers to: Mercury (planet)...",
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Mercury" } },
    };

    const result = mapSummaryResponse("Mercury", raw);

    expect(result).toEqual({ title: "Mercury", description: null, sourceUrl: null });
  });

  it("returns description: null and sourceUrl: null when raw is null (no article found)", () => {
    const result = mapSummaryResponse("NotARealPlace", null);

    expect(result).toEqual({ title: "NotARealPlace", description: null, sourceUrl: null });
  });

  it("returns description: null when a standard-type page has no extract", () => {
    const raw: WikipediaSummaryResponse = { type: "standard", title: "Somewhere" };

    const result = mapSummaryResponse("Somewhere", raw);

    expect(result.description).toBeNull();
  });

  it("returns sourceUrl: null when content_urls is missing entirely", () => {
    const raw: WikipediaSummaryResponse = {
      type: "standard",
      title: "Somewhere",
      extract: "A place.",
    };

    const result = mapSummaryResponse("Somewhere", raw);

    expect(result.sourceUrl).toBeNull();
  });
});
