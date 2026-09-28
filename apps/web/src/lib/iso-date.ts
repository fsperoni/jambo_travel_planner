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

const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/**
 * Formats a city-local, timezone-less datetime string (sunrise/sunset, or
 * `CurrentWeather.observedAt`) as a short time label (e.g. "7:38 AM").
 *
 * An earlier version relied on `new Date(localDateTime)` parsing the
 * offset-less string as local time in the *runtime's* own zone, reasoning
 * that formatting with no explicit `timeZone` would use that same zone
 * right back, cancelling out. That's true most of the time, but it's
 * wrong at a daylight-saving transition: parsing a wall-clock time that
 * falls inside a DST gap (a real one, confirmed directly — 02:30 doesn't
 * exist on 2026-03-08 in `America/Edmonton`, since clocks jump straight
 * from 2:00 to 3:00) makes the runtime normalize it forward, so
 * `formatLocalTime("2026-03-08T02:30")` silently returned "3:30 AM"
 * instead of the 02:30 the string actually says. The string's numbers are
 * parsed directly here instead — no local-time interpretation at any
 * point — and built into a UTC instant with those exact field values,
 * then formatted back with `timeZone: "UTC"` pinned. That displays the
 * string's own wall-clock time unchanged in every browser zone, including
 * inside a DST gap, confirmed directly the same way as before: formatting
 * the same string under several different `TZ` settings and a DST-gap
 * time and getting the same, correct result every time.
 */
export function formatLocalTime(localDateTime: string): string {
  const match = LOCAL_DATETIME_PATTERN.exec(localDateTime);
  if (!match) {
    // Defensive: every real caller passes a value shaped exactly like
    // Open-Meteo's own sunrise/sunset/observedAt fields. Failing loudly
    // here beats silently formatting something meaningless if that ever
    // stopped being true.
    throw new Error(`formatLocalTime: not a recognizable local datetime: "${localDateTime}"`);
  }
  // Non-null: none of the regex's five capture groups is optional, so a
  // successful match (already checked above) always populates all five.
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!)).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
