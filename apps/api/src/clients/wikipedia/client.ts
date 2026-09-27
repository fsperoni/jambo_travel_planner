import { fetchJson } from "../http.js";
import type { CityDescription } from "../../services/description.service.js";
import { mapSummaryResponse } from "./mapper.js";
import type { WikipediaSummaryResponse } from "./raw-types.js";

// Wikipedia's summary API is generally fast; matches the timeout budget
// used for Open-Meteo rather than inventing a different number without a
// reason to.
const REQUEST_TIMEOUT_MS = 5000;

export interface WikipediaClient {
  getSummary(title: string): Promise<CityDescription>;
}

/**
 * `baseUrl` and `userAgent` are constructor arguments (from
 * env.WIKIPEDIA_BASE_URL / env.WIKIPEDIA_USER_AGENT), not hardcoded
 * literals — same reasoning as the Open-Meteo client: integration tests
 * point this at a local stub instead of the real API.
 */
export function createWikipediaClient(baseUrl: string, userAgent: string): WikipediaClient {
  return {
    async getSummary(title) {
      // encodeURIComponent handles titles with spaces and non-ASCII
      // characters (e.g. "São Paulo") — confirmed against the real API
      // while building this, not assumed.
      const url = new URL(`/api/rest_v1/page/summary/${encodeURIComponent(title)}`, baseUrl);

      // Wikimedia's API rejects a request with no User-Agent outright (a
      // real 403, confirmed directly against the live API) — this is a
      // required header here, not a courtesy.
      const raw = await fetchJson<WikipediaSummaryResponse>(url.toString(), {
        timeoutMs: REQUEST_TIMEOUT_MS,
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        notFoundReturnsNull: true,
      });

      return mapSummaryResponse(title, raw);
    },
  };
}
