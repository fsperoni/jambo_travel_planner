// Mirrors the backend's response shapes (apps/api/src/services/auth.service.ts
// and friends). Deliberately duplicated here rather than shared via a
// packages/shared workspace — see the README's monorepo-structure section
// for that trade-off; integration/E2E tests are what catch the two copies
// drifting apart.

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface LoginResponse {
  accessToken: string;
  /** Seconds, matching the backend's ACCESS_TOKEN_TTL_SECONDS. */
  expiresIn: number;
  user: AuthenticatedUser;
}

export interface City {
  id: string;
  name: string;
  region?: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  wikipediaTitle: string;
}

export interface WeatherCondition {
  code: number;
  label: string;
}

export interface CurrentWeather {
  /** ISO local datetime, city-local — not converted to the browser's own
   *  time zone; see the backend's weather.service.ts for why. */
  observedAt: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  isDay: boolean;
  condition: WeatherCondition;
}

export interface DailyForecast {
  /** ISO calendar date, e.g. "2026-09-25". */
  date: string;
  condition: WeatherCondition;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbabilityMax: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherReport {
  timezone: string;
  localDate: string;
  allowedForecastDates: { min: string; max: string };
  units: {
    temperature: string;
    windSpeed: string;
    precipitationProbability: string;
  };
  current: CurrentWeather;
  week: DailyForecast[];
}
