import { http, HttpResponse } from "msw";
import type { City, CityDescription, WeatherReport } from "../../api/types";

// The app's default API base URL when VITE_API_BASE_URL isn't set — see
// api/http.ts. Tests never set that env var, so requests go here, and
// these handlers match against the same literal URL rather than a
// wildcard, so a typo'd path in application code shows up as an
// (MSW-reported) unhandled request instead of silently matching anyway.
const API_BASE_URL = "http://localhost:3000";

export const VALID_CREDENTIALS = { email: "person@example.com", password: "correct-password" };

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

export const MOCK_WEATHER_REPORT: WeatherReport = {
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
};

export const MOCK_CITY_DESCRIPTION: CityDescription = {
  title: "Calgary",
  description: "Calgary is the largest city in the Canadian province of Alberta.",
  sourceUrl: "https://en.wikipedia.org/wiki/Calgary",
};

// Default handlers, used unless a test overrides them with server.use(...)
// for a specific scenario (an error response, a delayed response, etc.).
export const handlers = [
  http.post(`${API_BASE_URL}/api/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };

    if (body.email === VALID_CREDENTIALS.email && body.password === VALID_CREDENTIALS.password) {
      return HttpResponse.json(MOCK_LOGIN_RESPONSE, { status: 200 });
    }

    return HttpResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid email or password" } },
      { status: 401 },
    );
  }),

  http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES, { status: 200 })),

  http.get(`${API_BASE_URL}/api/weather`, () =>
    HttpResponse.json(MOCK_WEATHER_REPORT, { status: 200 }),
  ),

  http.get(`${API_BASE_URL}/api/city-description`, () =>
    HttpResponse.json(MOCK_CITY_DESCRIPTION, { status: 200 }),
  ),
];
