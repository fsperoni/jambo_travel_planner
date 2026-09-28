// Shared, deterministic test data — used by the stub servers (stub-servers.ts)
// to build fixture responses, by global-setup.ts to seed the database, and
// by the spec itself to assert on. Kept in one file so a value only needs
// to be right in one place: e.g. Calgary's fixture temperature is defined
// once here and referenced by both "the stub returns this" and "the test
// expects this text on screen."

export const E2E_EMAIL = "e2e@example.com";
export const E2E_PASSWORD = "e2e-test-password-123";

// Dedicated ports, distinct from the normal local-dev ones (3000/5173) —
// so this suite never collides with a developer's own `npm run dev`
// already running in another terminal. Defined once here (rather than
// separately in playwright.config.ts and stub-servers.ts, which both need
// them) so the two can't silently drift out of sync with each other.
export const PORTS = {
  api: 4000,
  web: 4173,
  openMeteoStub: 4010,
  wikipediaStub: 4011,
} as const;

// Real coordinates/titles from domain/city-catalogue.ts — the stub servers
// key their fixture responses off these, so the app's real (unmocked)
// catalogue lookup still has to produce the right latitude/longitude/title
// for a fixture to be selected at all. A typo'd coordinate here would show
// up as a real, visible test failure, not a silently-wrong fixture.
export const CALGARY = {
  id: "calgary",
  name: "Calgary",
  latitude: 51.0447,
  longitude: -114.0719,
} as const;
export const TOKYO = {
  id: "tokyo",
  name: "Tokyo",
  latitude: 35.6762,
  longitude: 139.6503,
} as const;

// A fixed 7-day window. The app never looks at the server's real clock for
// "today" — it entirely trusts whatever `daily.time[0]` the weather
// provider (here, the stub) returns — so hardcoding these dates makes the
// whole test deterministic regardless of which real calendar day it runs
// on. See the README's timezone/date-handling section.
export const FORECAST_DATES = [
  "2026-09-27",
  "2026-09-28",
  "2026-09-29",
  "2026-09-30",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
] as const;

// today + 3 — inside the allowed today..+5 picker range, but not the first
// or last day, so picking it is a real, unambiguous user action rather
// than something that could pass by accident (e.g. by the picker already
// defaulting to a boundary).
export const SELECTED_DATE = FORECAST_DATES[3];

export const WEATHER_FIXTURES = {
  [CALGARY.id]: {
    conditionCode: 0,
    conditionLabel: "Clear sky",
    currentTemperature: 10,
    selectedDayTemperatureMax: 9,
  },
  [TOKYO.id]: {
    conditionCode: 61,
    conditionLabel: "Slight rain",
    currentTemperature: 22,
    selectedDayTemperatureMax: 24,
  },
} as const;

export const DESCRIPTION_FIXTURES = {
  [CALGARY.id]: "Calgary is a real testable city fixture, not the actual Wikipedia article.",
  [TOKYO.id]: "Tokyo is a real testable city fixture, not the actual Wikipedia article.",
} as const;
