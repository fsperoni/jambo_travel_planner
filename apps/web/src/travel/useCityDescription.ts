import { getCityDescription } from "../api/travel.api";
import type { CityDescription } from "../api/types";
import { useAbortableRequest } from "../lib/useAbortableRequest";

interface CityDescriptionState {
  cityDescription: CityDescription | null;
  isLoading: boolean;
  error: string | null;
  /** Same reasoning as useCityData's retry — a failure for the *same*
   *  title has no other way to re-trigger the effect. */
  retry: () => void;
}

/**
 * Fetched independently from useCityData, on purpose — see the README's
 * split-vs-aggregated-endpoints trade-off. If Wikipedia is slow or down,
 * the weather card still loads and renders normally; a description failure
 * doesn't take the whole page down with it, and vice versa.
 *
 * A thin wrapper around useAbortableRequest — see that hook for the
 * abort/loading/error/retry mechanics shared with useCityData.
 */
export function useCityDescription(wikipediaTitle: string | null): CityDescriptionState {
  const { data, isLoading, error, retry } = useAbortableRequest<CityDescription>(
    wikipediaTitle,
    // Non-null: useAbortableRequest only ever calls this when `key`
    // (wikipediaTitle) is non-null.
    (signal) => getCityDescription(wikipediaTitle!, signal),
  );

  return { cityDescription: data, isLoading, error, retry };
}
