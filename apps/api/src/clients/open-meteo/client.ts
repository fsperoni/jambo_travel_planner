import { fetchJson, UPSTREAM_TIMEOUT_MS } from "../http.js";
import type { WeatherReport } from "../../types/weather-report.js";
import { mapForecastResponse } from "./mapper.js";
import type { OpenMeteoForecastResponse } from "./raw-types.js";

const CURRENT_PARAMS =
  "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day";
const DAILY_PARAMS =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset";

export interface OpenMeteoClient {
  getForecast(latitude: number, longitude: number): Promise<WeatherReport>;
}

/**
 * `baseUrl` is a constructor argument (from `env.OPEN_METEO_BASE_URL`), not
 * a hardcoded literal — integration tests point this at a local stub
 * server instead of hitting the real Open-Meteo API. `apiKey` (from
 * `env.OPEN_METEO_API_KEY`) is unset for the free tier; when set, it's sent
 * as `X-Api-Key` rather than the `apikey` query param Open-Meteo also
 * accepts, so it never ends up in a logged request URL.
 */
export function createOpenMeteoClient(baseUrl: string, apiKey?: string): OpenMeteoClient {
  return {
    async getForecast(latitude, longitude) {
      const url = new URL("/v1/forecast", baseUrl);
      url.searchParams.set("latitude", String(latitude));
      url.searchParams.set("longitude", String(longitude));
      // "auto" resolves the timezone from the coordinates themselves, which
      // is what makes `daily.time[0]` the city-local "today" rather than
      // the server's own — see mapper.ts and the README's timezone section.
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("forecast_days", "7");
      url.searchParams.set("current", CURRENT_PARAMS);
      url.searchParams.set("daily", DAILY_PARAMS);

      const raw = await fetchJson<OpenMeteoForecastResponse>(url.toString(), {
        timeoutMs: UPSTREAM_TIMEOUT_MS,
        headers: apiKey ? { "X-Api-Key": apiKey } : undefined,
      });
      return mapForecastResponse(raw);
    },
  };
}
