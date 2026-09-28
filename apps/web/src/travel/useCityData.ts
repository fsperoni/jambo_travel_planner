import { getWeather } from "../api/travel.api";
import type { WeatherReport } from "../api/types";
import { useAbortableRequest } from "../lib/useAbortableRequest";

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
 * actually cares about. `date` is `null` rather than omitted when no
 * specific day is selected, so it's an explicit part of the request key
 * like the coordinates, not a value that silently defaults.
 *
 * A thin wrapper around useAbortableRequest — see that hook for the
 * abort/loading/error/retry mechanics shared with useCityDescription.
 */
export function useCityData(
  latitude: number | null,
  longitude: number | null,
  date: string | null = null,
): CityDataState {
  const key =
    latitude === null || longitude === null ? null : `${latitude},${longitude},${date ?? ""}`;

  const { data, isLoading, error, errorCode, retry } = useAbortableRequest<WeatherReport>(
    key,
    // Non-null: useAbortableRequest only ever calls this when `key` is
    // non-null, which (by the ternary above) only happens when both
    // coordinates are non-null too.
    (signal) => getWeather(latitude!, longitude!, date ?? undefined, signal),
  );

  return { weather: data, isLoading, error, errorCode, retry };
}
