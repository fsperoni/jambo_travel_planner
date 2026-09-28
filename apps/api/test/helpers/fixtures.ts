import type { DailyForecast, WeatherReport } from "../../src/types/weather-report.js";

// Shared test data — pulled out once several test files independently
// invented their own "some valid-looking test user" literals (which,
// besides the duplication, makes it easy for one copy to quietly drift
// from another, e.g. a password that no longer matches the hash a
// different file created for "the same" user).

/** A generic test user's credentials — used wherever a test needs "a user
 *  that exists," not a specific email or password for its own sake. */
export const TEST_USER = {
  id: "user-1",
  email: "person@example.com",
  password: "correct-password",
};

/** An email with deliberately no matching account — for the "unknown
 *  email" side of a login/lookup test. */
export const UNKNOWN_EMAIL = "nobody@example.com";

// 32+ characters, the minimum config/env.ts's Zod schema accepts for
// JWT_SECRET — shared by test-env.ts (for tests that build a full Env) and
// token.service.test.ts (for tests that construct a TokenService
// directly), so there's one definition of "a valid-length test secret"
// rather than two independently invented ones.
export const TEST_JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";

/** A single day's forecast, with sensible defaults — used wherever a test
 *  needs "some day's forecast," not specific weather values. */
export function buildDay(date: string, overrides: Partial<DailyForecast> = {}): DailyForecast {
  return {
    date,
    condition: { code: 3, label: "Overcast" },
    temperatureMax: 20,
    temperatureMin: 8,
    precipitationProbabilityMax: 10,
    sunrise: `${date}T07:00`,
    sunset: `${date}T19:00`,
    ...overrides,
  };
}

/** A full weather report, with sensible defaults — `week: []` by default
 *  (fine for tests that only care about `current`), or pass a `week` built
 *  from buildDay() for tests that need specific days (e.g. date-range
 *  boundary tests). */
export function buildWeatherReport(overrides: Partial<WeatherReport> = {}): WeatherReport {
  return {
    timezone: "America/Edmonton",
    localDate: "2026-09-25",
    allowedForecastDates: { min: "2026-09-25", max: "2026-09-30" },
    units: { temperature: "°C", windSpeed: "km/h", precipitationProbability: "%" },
    current: {
      observedAt: "2026-09-25T20:30",
      temperature: 13.4,
      feelsLike: 8.9,
      humidity: 40,
      windSpeed: 16.1,
      isDay: false,
      condition: { code: 2, label: "Partly cloudy" },
    },
    week: [],
    ...overrides,
  };
}
