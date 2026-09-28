import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenMeteoClient } from "./client.js";
import type { OpenMeteoForecastResponse } from "./raw-types.js";

// fetch itself is stubbed, same style as clients/http.test.ts — this file
// is about the *request* this client builds (URL, query params) and that
// it hands the response to the real mapper, not about fetchJson's own
// error handling (already covered there).
function rawResponse(): OpenMeteoForecastResponse {
  return {
    timezone: "America/Edmonton",
    current: {
      time: "2026-09-25T20:30",
      temperature_2m: 13.4,
      apparent_temperature: 8.9,
      relative_humidity_2m: 40,
      weather_code: 2,
      wind_speed_10m: 16.1,
      is_day: 0,
    },
    daily: {
      time: ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"],
      weather_code: [2, 3, 3, 61, 61, 0],
      temperature_2m_max: [23.1, 22, 21, 20, 19, 18],
      temperature_2m_min: [7, 6, 6, 5, 5, 4],
      precipitation_probability_max: [7, 10, 10, 60, 60, 0],
      sunrise: [
        "2026-09-25T07:27",
        "2026-09-26T07:28",
        "2026-09-27T07:29",
        "2026-09-28T07:31",
        "2026-09-29T07:32",
        "2026-09-30T07:33",
      ],
      sunset: [
        "2026-09-25T19:27",
        "2026-09-26T19:25",
        "2026-09-27T19:23",
        "2026-09-28T19:21",
        "2026-09-29T19:19",
        "2026-09-30T19:17",
      ],
    },
  };
}

describe("Open-Meteo client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the forecast endpoint with the expected query parameters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(rawResponse()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenMeteoClient("https://api.open-meteo.com");
    await client.getForecast(51.0447, -114.0719);

    const [requestUrl] = fetchMock.mock.calls[0] as [string];
    const url = new URL(requestUrl);
    expect(url.pathname).toBe("/v1/forecast");
    expect(url.searchParams.get("latitude")).toBe("51.0447");
    expect(url.searchParams.get("longitude")).toBe("-114.0719");
    // "auto" is what makes daily.time[0] the city-local "today" — see
    // mapper.ts and the README's timezone-handling section.
    expect(url.searchParams.get("timezone")).toBe("auto");
    expect(url.searchParams.get("forecast_days")).toBe("7");
    expect(url.searchParams.get("current")).toContain("temperature_2m");
    expect(url.searchParams.get("daily")).toContain("weather_code");
  });

  it("maps the response through the real mapper into a WeatherReport", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(rawResponse()), { status: 200 })),
    );

    const client = createOpenMeteoClient("https://api.open-meteo.com");
    const report = await client.getForecast(51.0447, -114.0719);

    expect(report.timezone).toBe("America/Edmonton");
    expect(report.localDate).toBe("2026-09-25");
    expect(report.current.temperature).toBe(13.4);
    expect(report.week).toHaveLength(6);
  });
});
