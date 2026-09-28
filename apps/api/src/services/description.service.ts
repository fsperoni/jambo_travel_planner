import type { CityDescription } from "../types/city-description.js";
import type { WikipediaClient } from "../clients/wikipedia/client.js";

export interface DescriptionService {
  getCityDescription(title: string): Promise<CityDescription>;
}

export interface DescriptionServiceDependencies {
  wikipediaClient: WikipediaClient;
}

/**
 * A thin pass-through, same reasoning as weather.service.ts: the layer
 * exists so a controller never talks to a vendor client directly, not
 * because there's non-trivial orchestration happening here today.
 */
export function createDescriptionService({
  wikipediaClient,
}: DescriptionServiceDependencies): DescriptionService {
  return {
    getCityDescription(title) {
      return wikipediaClient.getSummary(title);
    },
  };
}
