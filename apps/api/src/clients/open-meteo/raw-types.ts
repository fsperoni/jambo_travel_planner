// The exact shape of a successful response from Open-Meteo's
// /v1/forecast endpoint, for the specific `current`/`daily` parameters
// client.ts requests — confirmed against a real response, not written from
// documentation alone. Only the fields this app actually reads are
// declared; Open-Meteo's response includes several more (elevation,
// generationtime_ms, *_units echoes, etc.) that are simply ignored.
export interface OpenMeteoForecastResponse {
  timezone: string;
  current: {
    /** Local datetime, no UTC offset/Z suffix — e.g. "2026-09-25T20:30". */
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    /** WMO weather code — see domain/weather-codes.ts. */
    weather_code: number;
    wind_speed_10m: number;
    /** 0 or 1, not a boolean. */
    is_day: number;
  };
  daily: {
    /** ISO calendar dates, e.g. "2026-09-25" — index 0 is the city-local
     *  "today", per `timezone=auto`. */
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
  };
}
