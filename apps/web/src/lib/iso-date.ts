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
