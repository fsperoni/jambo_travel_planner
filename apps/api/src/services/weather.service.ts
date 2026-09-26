import type { WeatherCondition } from "../domain/weather-codes.js";
import type { OpenMeteoClient } from "../clients/open-meteo/client.js";

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
}

export interface WeatherService {
  getWeatherReport(latitude: number, longitude: number): Promise<WeatherReport>;
}

export interface WeatherServiceDependencies {
  openMeteoClient: OpenMeteoClient;
}

/**
 * A thin pass-through today — it exists as a service (rather than having
 * the controller call the client directly) because it's the layer that
 * will own real business logic starting Stage 7: validating a requested
 * forecast date against `allowedForecastDates` and picking out the
 * matching day as `selectedDay`. That's request-shaping logic specific to
 * *this app*, not something the Open-Meteo client (which only knows how to
 * fetch and normalize a 7-day forecast) should be responsible for.
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
