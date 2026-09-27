import { useEffect, useState } from "react";
import { ApiError } from "../api/http";
import { getCityDescription } from "../api/travel.api";
import type { CityDescription } from "../api/types";

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
 */
export function useCityDescription(wikipediaTitle: string | null): CityDescriptionState {
  const [cityDescription, setCityDescription] = useState<CityDescription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (wikipediaTitle === null) {
      setCityDescription(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Same stale-response guard as useCityData — see that hook for why.
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getCityDescription(wikipediaTitle, controller.signal)
      .then((result) => {
        setCityDescription(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [wikipediaTitle, retryCount]);

  return { cityDescription, isLoading, error, retry: () => setRetryCount((count) => count + 1) };
}
