import { getWeather } from "../api/travel.api";
import type { WeatherReport } from "../api/types";
import { useAbortableRequest } from "../lib/useAbortableRequest";

interface CityDataState {
  weather: WeatherReport | null;
  isLoading: boolean;
  error: string | null;
  /** Mirrors the backend's `error.code` (e.g. "UPSTREAM_ERROR") — exposed
   *  so a caller can react to a *specific* failure without this hook
   *  needing to know what that reaction should be. `null` whenever `error`
   *  is, and also whenever a non-ApiError failure occurred. */
  errorCode: string | null;
  /** Re-runs the fetch for the current coordinates. Needed because a
   *  failure for the *currently selected* city has no other way to retry —
   *  switching cities changes the effect's dependencies and re-triggers it
   *  on its own, but retrying the same one doesn't. */
  retry: () => void;
}

/**
 * Takes coordinates rather than a whole `City` object — a `City`'s object
 * identity would change across renders in ways that are easy to get wrong
 * (a fresh object breaks the `useEffect` dependency comparison even for
 * "the same" city), whereas `latitude`/`longitude` are plain numbers with
 * no such footgun, and they're the only part of a `City` this hook
 * actually cares about.
 *
 * Deliberately has no `date` parameter, even though `<ForecastDatePicker>`
 * lets the user pick one — a forecast date never changes which report this
 * fetches (Open-Meteo always returns the same 7-day week regardless of
 * what day, if any, the frontend cares about), so folding it into this
 * hook's key used to re-fetch and visibly reload the entire report (current
 * + week, not just the requested day) on every date pick. `week` already
 * contains every day a date picker can select; matching a picked date
 * against it is TravelPlannerPage's job now, done without a network
 * request. Removed at Fabio's request after reviewing and using the app —
 * see the README's forecast-date-picker section and this date's AI_USAGE.md
 * entry.
 *
 * A thin wrapper around useAbortableRequest — see that hook for the
 * abort/loading/error/retry mechanics shared with useCityDescription.
 */
export function useCityData(latitude: number | null, longitude: number | null): CityDataState {
  const key = latitude === null || longitude === null ? null : `${latitude},${longitude}`;

  const { data, isLoading, error, errorCode, retry } = useAbortableRequest<WeatherReport>(
    key,
    // Non-null: useAbortableRequest only ever calls this when `key` is
    // non-null, which (by the ternary above) only happens when both
    // coordinates are non-null too.
    (signal) => getWeather(latitude!, longitude!, signal),
  );

  return { weather: data, isLoading, error, errorCode, retry };
}
