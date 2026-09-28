import { truncateAtWordBoundary } from "../../domain/truncate-text.js";
import type { CityDescription } from "../../types/city-description.js";
import type { WikipediaSummaryResponse } from "./raw-types.js";

// A Wikipedia extract's length varies wildly by city — a couple of
// sentences for a smaller city, several paragraphs for somewhere like New
// York City (854 characters in a real response, confirmed while building
// this) — capped so "a short description" means the same thing for every
// city, rather than however long that city's own article happens to be.
const MAX_DESCRIPTION_LENGTH = 280;

/**
 * Maps Wikipedia's raw response to our own `CityDescription`. `raw` is
 * `null` when the client already determined there's no page at all (a 404,
 * handled by fetchJson's notFoundReturnsNull — see client.ts) — treated
 * identically to a disambiguation page, since both mean "nothing
 * meaningful to show," and the frontend's empty state doesn't need to
 * distinguish "no article" from "an ambiguous title with several."
 */
export function mapSummaryResponse(
  requestedTitle: string,
  raw: WikipediaSummaryResponse | null,
): CityDescription {
  if (!raw || raw.type === "disambiguation") {
    return { title: requestedTitle, description: null, sourceUrl: null };
  }

  return {
    // Wikipedia's own canonical title, not necessarily identical to what
    // was requested (e.g. it could differ in capitalization) — this is
    // the title that actually resolved to a real article.
    title: raw.title,
    description: raw.extract ? truncateAtWordBoundary(raw.extract, MAX_DESCRIPTION_LENGTH) : null,
    sourceUrl: raw.content_urls?.desktop?.page ?? null,
  };
}
