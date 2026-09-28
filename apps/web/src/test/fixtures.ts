import type { City, CityDescription, DetectedLocation, WeatherReport } from "../api/types";

// Shared test data for MSW handlers and the tests that override them —
// pulled into its own file (separate from msw/handlers.ts, which now holds
// only the handlers themselves) once several test files independently
// invented their own "some city," "some weather report" literals, several
// of them byte-for-byte identical to what was already here.

export const VALID_CREDENTIALS = { email: "person@example.com", password: "correct-password" };

// Deliberately doesn't match any account — for the "wrong credentials"
// side of a login test.
export const INVALID_CREDENTIALS = { email: "wrong@example.com", password: "wrong-password" };

export const MOCK_LOGIN_RESPONSE = {
  accessToken: "mock-access-token",
  expiresIn: 900,
  user: { id: "user-1", email: VALID_CREDENTIALS.email },
};

export const MOCK_CITIES: City[] = [
  {
    id: "calgary",
    name: "Calgary",
    region: "Alberta",
    countryCode: "CA",
    latitude: 51.0447,
    longitude: -114.0719,
    wikipediaTitle: "Calgary",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    countryCode: "JP",
    latitude: 35.6762,
    longitude: 139.6503,
    wikipediaTitle: "Tokyo",
  },
];

/** A full weather report, with sensible defaults — pass `overrides` for a
 *  test that needs specific values (a different temperature/condition to
 *  tell two cities' responses apart, a specific `week`, etc.). Replaces
 *  what used to be several near-identical `makeReport`/`reportWith`
 *  functions, one invented per test file. */
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

export const MOCK_WEATHER_REPORT: WeatherReport = buildWeatherReport({
  week: [
    {
      date: "2026-09-25",
      condition: { code: 3, label: "Overcast" },
      temperatureMax: 23.1,
      temperatureMin: 7,
      precipitationProbabilityMax: 7,
      sunrise: "2026-09-25T07:27",
      sunset: "2026-09-25T19:27",
    },
  ],
});

export const MOCK_CITY_DESCRIPTION: CityDescription = {
  title: "Calgary",
  description: "Calgary is the largest city in the Canadian province of Alberta.",
  sourceUrl: "https://en.wikipedia.org/wiki/Calgary",
};

// Deliberately the same city (same id) as MOCK_CITIES[0] — tests that
// don't care about location detection specifically get the same default
// selection (Calgary) without needing to mock this endpoint themselves.
export const MOCK_LOCATION: DetectedLocation = {
  city: MOCK_CITIES[0]!, // non-null: MOCK_CITIES is a fixed literal, never empty
  source: "default",
  reason: "local-development",
};
