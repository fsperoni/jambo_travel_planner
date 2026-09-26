import { useEffect, useState } from "react";

/**
 * Becomes `true` only once `active` has stayed `true` for at least
 * `delayMs` — used to show a "this is taking a while" notice without it
 * flashing on screen for every request regardless of how fast it resolves.
 * Resets to `false` as soon as `active` goes false.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    if (!active) {
      setFlag(false);
      return;
    }
    const timer = setTimeout(() => setFlag(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return flag;
}
