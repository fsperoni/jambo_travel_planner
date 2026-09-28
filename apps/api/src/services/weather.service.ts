import type { OpenMeteoClient } from "../clients/open-meteo/client.js";
import { ForecastDateOutOfRangeError } from "../errors/app-error.js";
import type { WeatherReport } from "../types/weather-report.js";

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
