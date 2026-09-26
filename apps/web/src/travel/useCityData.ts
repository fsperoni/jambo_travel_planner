import { useEffect, useState } from "react";
import { ApiError } from "../api/http";
import { getWeather } from "../api/travel.api";
import type { WeatherReport } from "../api/types";

interface CityDataState {
  weather: WeatherReport | null;
  isLoading: boolean;
  error: string | null;
  /** Re-runs the fetch for the current coordinates. Needed because a
   *  failure for the *currently selected* city has no other way to
   *  retry — switching cities changes latitude/longitude and re-triggers
   *  the effect on its own, but retrying the same city doesn't. */
  retry: () => void;
}

/**
 * Takes coordinates rather than a whole `City` object — a `City`'s object
 * identity would change across renders in ways that are easy to get wrong
 * (a fresh object breaks the `useEffect` dependency comparison even for
 * "the same" city), whereas `latitude`/`longitude` are plain numbers with
 * no such footgun, and they're the only part of a `City` this hook
 * actually cares about.
 */
export function useCityData(latitude: number | null, longitude: number | null): CityDataState {
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (latitude === null || longitude === null) {
      setWeather(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Aborts the in-flight request if the user switches cities again before
    // this one resolves — without this, a slow first response arriving
    // after a faster second one would overwrite the newer city's weather
    // with the older, now-stale city's data.
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getWeather(latitude, longitude, controller.signal)
      .then((result) => {
        setWeather(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [latitude, longitude, retryCount]);

  return { weather, isLoading, error, retry: () => setRetryCount((count) => count + 1) };
}
