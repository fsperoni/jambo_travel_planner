/**
 * Formats an ISO calendar date string ("YYYY-MM-DD") as a short weekday
 * name ("Mon", "Tue", ...).
 *
 * `new Date("2026-09-25")` parses as UTC midnight; letting
 * `toLocaleDateString` then render that instant in the *browser's own*
 * time zone would silently shift the displayed weekday by a day for any
 * browser west of UTC (e.g. Honolulu, UTC-10) — the same instant is
 * already "yesterday" there. Passing `timeZone: "UTC"` keeps the
 * formatting locked to the date string's own UTC-midnight instant instead
 * of reinterpreting it in wherever the browser happens to be, which is
 * what actually avoids the shift.
 */
export function formatWeekday(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    timeZone: "UTC",
  });
}

/**
 * Formats an ISO calendar date string as a full, unambiguous label (e.g.
 * "Sunday, October 2") for the forecast date picker's selected-day card —
 * same UTC-pinning reasoning as `formatWeekday`, since this has the exact
 * same off-by-one risk.
 */
export function formatFullDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formats a city-local, timezone-less datetime string (sunrise/sunset, or
 * `CurrentWeather.observedAt`) as a short time label (e.g. "7:38 AM").
 *
 * Deliberately does *not* pin `timeZone` the way `formatWeekday`/
 * `formatFullDate` do: a string like "2026-10-02T07:38" has no timezone
 * offset, so `new Date(...)` parses it as local time in whatever zone the
 * runtime happens to be in — and formatting with no explicit `timeZone`
 * uses that exact same zone. The two cancel out, so the wall-clock time in
 * the string is always what's displayed, regardless of the browser's own
 * time zone — confirmed directly by formatting the same string under
 * different `TZ` settings and getting the same result back every time,
 * rather than assumed from how the two calls "should" interact.
 */
export function formatLocalTime(localDateTime: string): string {
  return new Date(localDateTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
