import type { WeatherCondition } from "../domain/weather-codes.js";

// The weather DTO shape, shared by the Open-Meteo client (which produces
// it) and weather.service.ts (which consumes and enriches it). Living here
// rather than in either of those two files avoids the two-way import that
// would otherwise exist between a client and the service that depends on
// it (the client would import from the service just to get this type back).
export interface CurrentWeather {
  /** ISO local datetime (e.g. "2026-09-25T20:30"), in the city's own time
   *  zone — deliberately not converted to UTC; see the README's timezone
   *  handling section for why local strings are kept as-is end to end. */
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
  /** IANA time zone name for the requested coordinates, e.g. "America/Edmonton". */
  timezone: string;
  /** The city-local calendar date "today" — i.e. `week[0].date`. */
  localDate: string;
  /** The inclusive range of dates the forecast-date picker may request,
   *  computed from the same 7-day response rather than derived from the
   *  server's own clock — see the README's timezone handling section. */
  allowedForecastDates: { min: string; max: string };
  units: {
    temperature: string;
    windSpeed: string;
    precipitationProbability: string;
  };
  current: CurrentWeather;
  week: DailyForecast[];
  /** The `week` entry matching a requested `date`, pulled out for
   *  convenience — present only when the caller asked for a specific
   *  date. Absent (not `null`) when no date was requested, so the
   *  frontend can tell "no date picked" apart from "picked a date" with a
   *  plain `if (report.selectedDay)` rather than a three-state field. */
  selectedDay?: DailyForecast;
}
