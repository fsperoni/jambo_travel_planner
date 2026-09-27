export interface CityDescription {
  title: string;
  /** `null` when Wikipedia has no article for this title, or when the
   *  title resolves to a disambiguation page rather than a real article —
   *  both are normal, expected outcomes, not failures (see D3 in the
   *  project plan / README's Trade-offs section). */
  description: string | null;
  sourceUrl: string | null;
}

export interface DescriptionService {
  getCityDescription(title: string): Promise<CityDescription>;
}

export interface DescriptionServiceDependencies {
  wikipediaClient: { getSummary(title: string): Promise<CityDescription> };
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
