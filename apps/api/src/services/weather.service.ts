import type { WeatherCondition } from "../domain/weather-codes.js";
import type { OpenMeteoClient } from "../clients/open-meteo/client.js";
import { ForecastDateOutOfRangeError } from "../errors/app-error.js";

export interface CurrentWeather {
  /** ISO local datetime (e.g. "2026-09-25T20:30"), in the city's own time
   *  zone — deliberately not converted to UTC; see the README's timezone
   *  section (Stage 7) for why local strings are kept as-is end to end. */
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
  /** The inclusive range of dates Stage 7's forecast-date picker may
   *  request, computed from the same 7-day response rather than derived
   *  from the server's own clock — see README (Stage 7) once that lands. */
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

export interface WeatherService {
  getWeatherReport(latitude: number, longitude: number, date?: string): Promise<WeatherReport>;
}

export interface WeatherServiceDependencies {
  openMeteoClient: OpenMeteoClient;
}

/**
 * A thin pass-through when no `date` is requested; with one, this is the
 * layer that owns the business logic the Open-Meteo client shouldn't have
 * to know about — validating the requested date against the report's own
 * `allowedForecastDates` and picking out the matching day as
 * `selectedDay`. The *shape* of the date string itself (a real, valid
 * "YYYY-MM-DD") is already guaranteed by controllers/travel.controller.ts's
 * Zod schema by the time it reaches here; this only checks whether that
 * valid date falls in range for *this* city.
 */
export function createWeatherService({
  openMeteoClient,
}: WeatherServiceDependencies): WeatherService {
  return {
    async getWeatherReport(latitude, longitude, date) {
      const report = await openMeteoClient.getForecast(latitude, longitude);
      if (date === undefined) {
        return report;
      }

      const { min, max } = report.allowedForecastDates;
      if (date < min || date > max) {
        throw new ForecastDateOutOfRangeError({ min, max });
      }

      const selectedDay = report.week.find((day) => day.date === date);
      if (!selectedDay) {
        // Shouldn't happen structurally: `week` always spans
        // [min, min + 6] and `date` has just been checked to fall in
        // [min, max] (max = min + 5) — but Open-Meteo lying about its own
        // shape is already a documented failure mode (see the
        // open-meteo mapper), so this fails loudly rather than silently
        // omitting selectedDay from the response.
        throw new Error(`No forecast entry found for requested date ${date}`);
      }

      return { ...report, selectedDay };
    },
  };
}
