import { useEffect, useRef, useState } from "react";
import { ApiError, GENERIC_ERROR_MESSAGE } from "../api/http";

export interface AbortableRequestState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  /** Mirrors the backend's `error.code` (e.g. "FORECAST_DATE_OUT_OF_RANGE")
   *  — exposed so a caller can react to a *specific* failure without this
   *  hook needing to know what that reaction should be. `null` whenever
   *  `error` is, and also whenever a non-ApiError failure occurred. */
  errorCode: string | null;
  /** Re-runs `request` for the current `key`. Needed because a failure for
   *  the *current* key has no other way to retry — a `key` change
   *  re-triggers the effect on its own, but retrying the same one doesn't. */
  retry: () => void;
}

/**
 * The abort/loading/error/retry state machine shared by useCityData and
 * useCityDescription — extracted here once both hooks turned out to be the
 * same ~40 lines with only the request function and its inputs differing.
 *
 * `key` is a plain string (or `null` to mean "nothing to fetch yet") that
 * encodes every input `request` depends on — e.g. `` `${lat},${lon},${date
 * ?? ""}` ``. Using one string, rather than passing the individual inputs
 * as separate hook arguments, keeps the underlying `useEffect`'s dependency
 * array to `[key, retryCount]`: exhaustive-deps is satisfied honestly. This
 * is still a manually maintained contract, though, not one ESLint or the
 * type system can check — nothing stops a caller from building `key` from
 * a subset of what `request` actually reads. A test that changes only the
 * omitted input can catch that gap (the effect wouldn't re-run when it
 * should), but nothing guarantees such a test exists.
 *
 * `request` is read through a ref updated on every render rather than
 * added to the effect's own dependencies — it's typically a fresh closure
 * on every render (e.g. `(signal) => getWeather(lat, lon, date, signal)`),
 * and putting a fresh function in a dependency array would re-run the
 * effect every render regardless of whether `key` actually changed.
 */
export function useAbortableRequest<T>(
  key: string | null,
  request: (signal: AbortSignal) => Promise<T>,
): AbortableRequestState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    if (key === null) {
      setData(null);
      setError(null);
      setErrorCode(null);
      setIsLoading(false);
      return;
    }

    // Aborts the in-flight request if `key` changes again before this one
    // resolves — without this, a slow first response arriving after a
    // faster second one would overwrite the newer selection's data with
    // stale data (e.g. switching cities quickly, or picking a new date).
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    requestRef
      .current(controller.signal)
      .then((result) => {
        // Guards the success path the same way the catch below already
        // does: `request` isn't guaranteed to actually honor the signal
        // it's given (a caller's fetch could ignore cancellation, or
        // simply finish in the narrow window between an abort and its own
        // resolution) — without this, a superseded request that happens
        // to resolve anyway could still overwrite newer data with stale
        // data, the exact race this hook exists to prevent.
        if (controller.signal.aborted) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError) {
          setError(err.message);
          setErrorCode(err.code);
        } else {
          setError(GENERIC_ERROR_MESSAGE);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
    // `request` is intentionally not a dependency — see the function
    // comment above for why it's read via requestRef instead. Nothing
    // here references it directly, so exhaustive-deps has nothing to warn
    // about; `key` is the complete, caller-supplied dependency list.
  }, [key, retryCount]);

  return { data, isLoading, error, errorCode, retry: () => setRetryCount((count) => count + 1) };
}
