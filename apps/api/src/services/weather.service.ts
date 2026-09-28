import type { OpenMeteoClient } from "../clients/open-meteo/client.js";
import type { WeatherReport } from "../types/weather-report.js";

export interface WeatherService {
  getWeatherReport(latitude: number, longitude: number): Promise<WeatherReport>;
}

export interface WeatherServiceDependencies {
  openMeteoClient: OpenMeteoClient;
}

/**
 * A thin pass-through, same reasoning as description.service.ts: the layer
 * exists so a controller never talks to a vendor client directly, not
 * because there's non-trivial orchestration happening here today. It used
 * to also validate an optional `date` query param and attach the matching
 * `week` entry as `selectedDay` — removed at Fabio's request after
 * reviewing and using the app: picking a forecast date re-fetched (and
 * visibly reloaded) the *entire* report, including the current-conditions
 * and week-strip cards that a date pick never actually changes, because
 * `date` never affected the Open-Meteo request this service makes
 * (`openMeteoClient.getForecast(latitude, longitude)` never took it) —
 * the response for a given city is identical regardless of what date, if
 * any, is requested alongside it. `selectedDay` was always just
 * `report.week.find((day) => day.date === date)`, a value the frontend
 * already has as soon as the first (dateless) request resolves. See the
 * README's forecast-date-picker section and this date's AI_USAGE.md entry
 * for the full before/after.
 */
export function createWeatherService({
  openMeteoClient,
}: WeatherServiceDependencies): WeatherService {
  return {
    getWeatherReport(latitude, longitude) {
      return openMeteoClient.getForecast(latitude, longitude);
    },
  };
}
