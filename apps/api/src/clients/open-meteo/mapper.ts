import { describeWeatherCode } from "../../domain/weather-codes.js";
import type { CurrentWeather, DailyForecast, WeatherReport } from "../../types/weather-report.js";
import type { OpenMeteoForecastResponse } from "./raw-types.js";

const UNITS = {
  temperature: "°C",
  windSpeed: "km/h",
  precipitationProbability: "%",
} as const;

/** Maps Open-Meteo's raw response to our own `WeatherReport` — this is the
 *  one place that vendor shape (snake_case fields, `is_day` as 0/1, five
 *  parallel `daily` arrays) is ever read; nothing outside this file ever
 *  sees `OpenMeteoForecastResponse`. */
export function mapForecastResponse(raw: OpenMeteoForecastResponse): WeatherReport {
  const localDate = raw.daily.time[0];
  if (!localDate) {
    // Genuinely malformed upstream data, not a client-facing 502/504 —
    // this isn't "Open-Meteo was unreachable," it's "Open-Meteo answered
    // but lied about its own response shape," which the central error
    // handler turns into a generic 500 rather than something to retry.
    throw new Error("Open-Meteo response is missing daily forecast data");
  }

  const current: CurrentWeather = {
    observedAt: raw.current.time,
    temperature: raw.current.temperature_2m,
    feelsLike: raw.current.apparent_temperature,
    humidity: raw.current.relative_humidity_2m,
    windSpeed: raw.current.wind_speed_10m,
    isDay: raw.current.is_day === 1,
    condition: describeWeatherCode(raw.current.weather_code),
  };

  const week: DailyForecast[] = raw.daily.time.map((date, index) =>
    mapDailyEntry(raw.daily, date, index),
  );

  return {
    timezone: raw.timezone,
    localDate,
    allowedForecastDates: {
      min: localDate,
      // Open-Meteo is asked for exactly 7 days (client.ts), so index 5 is
      // "today + 5" — the boundary the forecast-date picker enforces.
      max: raw.daily.time[5] ?? localDate,
    },
    units: UNITS,
    current,
    week,
  };
}

function mapDailyEntry(
  daily: OpenMeteoForecastResponse["daily"],
  date: string,
  index: number,
): DailyForecast {
  const weatherCode = daily.weather_code[index];
  const temperatureMax = daily.temperature_2m_max[index];
  const temperatureMin = daily.temperature_2m_min[index];
  const precipitationProbabilityMax = daily.precipitation_probability_max[index];
  const sunrise = daily.sunrise[index];
  const sunset = daily.sunset[index];

  if (
    weatherCode === undefined ||
    temperatureMax === undefined ||
    temperatureMin === undefined ||
    precipitationProbabilityMax === undefined ||
    sunrise === undefined ||
    sunset === undefined
  ) {
    // `daily` is five parallel arrays keyed by the same index as `time` —
    // this only happens if Open-Meteo ever returned mismatched array
    // lengths, which would be a malformed response, not a user-facing
    // input problem.
    throw new Error(`Open-Meteo daily forecast is missing data for ${date}`);
  }

  return {
    date,
    condition: describeWeatherCode(weatherCode),
    temperatureMax,
    temperatureMin,
    precipitationProbabilityMax,
    sunrise,
    sunset,
  };
}
