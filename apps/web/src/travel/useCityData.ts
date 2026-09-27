import { useEffect, useState } from "react";
import { ApiError } from "../api/http";
import { getWeather } from "../api/travel.api";
import type { WeatherReport } from "../api/types";

interface CityDataState {
  weather: WeatherReport | null;
  isLoading: boolean;
  error: string | null;
  /** Mirrors the backend's `error.code` (e.g. "FORECAST_DATE_OUT_OF_RANGE")
   *  — exposed so a caller can react to a *specific* failure (see
   *  TravelPlannerPage's date-reset-on-out-of-range logic) without this
   *  hook needing to know what that reaction should be. `null` whenever
   *  `error` is, and also whenever a non-ApiError failure occurred. */
  errorCode: string | null;
  /** Re-runs the fetch for the current coordinates/date. Needed because a
   *  failure for the *currently selected* city/date has no other way to
   *  retry — switching cities (or dates) changes the effect's dependencies
   *  and re-triggers it on its own, but retrying the same one doesn't. */
  retry: () => void;
}

/**
 * Takes coordinates rather than a whole `City` object — a `City`'s object
 * identity would change across renders in ways that are easy to get wrong
 * (a fresh object breaks the `useEffect` dependency comparison even for
 * "the same" city), whereas `latitude`/`longitude` are plain numbers with
 * no such footgun, and they're the only part of a `City` this hook
 * actually cares about. `date` (Stage 7) is `null` rather than omitted
 * when no specific day is selected, so it's an explicit effect dependency
 * like the coordinates, not a value that silently defaults.
 */
export function useCityData(
  latitude: number | null,
  longitude: number | null,
  date: string | null = null,
): CityDataState {
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (latitude === null || longitude === null) {
      setWeather(null);
      setError(null);
      setErrorCode(null);
      setIsLoading(false);
      return;
    }

    // Aborts the in-flight request if the user switches cities (or picks a
    // different date) again before this one resolves — without this, a
    // slow first response arriving after a faster second one would
    // overwrite the newer selection's weather with stale data.
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    getWeather(latitude, longitude, date ?? undefined, controller.signal)
      .then((result) => {
        setWeather(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError) {
          setError(err.message);
          setErrorCode(err.code);
        } else {
          setError("Something went wrong. Please try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [latitude, longitude, date, retryCount]);

  return {
    weather,
    isLoading,
    error,
    errorCode,
    retry: () => setRetryCount((count) => count + 1),
  };
}
