import { describe, expect, it } from "vitest";
import { mapForecastResponse } from "./mapper.js";
import type { OpenMeteoForecastResponse } from "./raw-types.js";

// Based on a real response captured from api.open-meteo.com for Calgary's
// coordinates, not written from documentation alone.
function makeRawResponse(
  overrides: Partial<OpenMeteoForecastResponse> = {},
): OpenMeteoForecastResponse {
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
      time: [
        "2026-09-25",
        "2026-09-26",
        "2026-09-27",
        "2026-09-28",
        "2026-09-29",
        "2026-09-30",
        "2026-10-01",
      ],
      weather_code: [3, 3, 3, 3, 3, 53, 80],
      temperature_2m_max: [23.1, 12.7, 14.3, 16.7, 21.4, 13.5, 7.9],
      temperature_2m_min: [7, 3.9, -0.4, 3.9, 7.4, 5.5, 1.6],
      precipitation_probability_max: [7, 15, 1, 0, 7, 17, 20],
      sunrise: [
        "2026-09-25T07:27",
        "2026-09-26T07:29",
        "2026-09-27T07:30",
        "2026-09-28T07:32",
        "2026-09-29T07:33",
        "2026-09-30T07:35",
        "2026-10-01T07:37",
      ],
      sunset: [
        "2026-09-25T19:27",
        "2026-09-26T19:24",
        "2026-09-27T19:22",
        "2026-09-28T19:20",
        "2026-09-29T19:18",
        "2026-09-30T19:15",
        "2026-10-01T19:13",
      ],
    },
    ...overrides,
  };
}

describe("mapForecastResponse", () => {
  it("maps current weather, converting is_day from 0/1 to a boolean", () => {
    const report = mapForecastResponse(makeRawResponse());

    expect(report.current).toEqual({
      observedAt: "2026-09-25T20:30",
      temperature: 13.4,
      feelsLike: 8.9,
      humidity: 40,
      windSpeed: 16.1,
      isDay: false,
      condition: { code: 2, label: "Partly cloudy" },
    });
  });

  it("maps is_day: 1 to true", () => {
    const raw = makeRawResponse();
    const report = mapForecastResponse({ ...raw, current: { ...raw.current, is_day: 1 } });

    expect(report.current.isDay).toBe(true);
  });

  it("maps all 7 days of the week, in order, with WMO labels attached", () => {
    const report = mapForecastResponse(makeRawResponse());

    expect(report.week).toHaveLength(7);
    expect(report.week[0]).toEqual({
      date: "2026-09-25",
      condition: { code: 3, label: "Overcast" },
      temperatureMax: 23.1,
      temperatureMin: 7,
      precipitationProbabilityMax: 7,
      sunrise: "2026-09-25T07:27",
      sunset: "2026-09-25T19:27",
    });
    expect(report.week[6]?.condition).toEqual({ code: 80, label: "Slight rain showers" });
  });

  it("sets localDate to daily.time[0] and allowedForecastDates to today..today+5", () => {
    const report = mapForecastResponse(makeRawResponse());

    expect(report.localDate).toBe("2026-09-25");
    expect(report.allowedForecastDates).toEqual({ min: "2026-09-25", max: "2026-09-30" });
  });

  it("passes through whatever IANA timezone Open-Meteo resolved for the coordinates", () => {
    const report = mapForecastResponse(makeRawResponse({ timezone: "Asia/Tokyo" }));

    expect(report.timezone).toBe("Asia/Tokyo");
  });

  it("throws if daily.time has no entries at all", () => {
    const base = makeRawResponse();
    const raw = { ...base, daily: { ...base.daily, time: [] } };

    expect(() => mapForecastResponse(raw)).toThrow(/missing daily forecast data/);
  });

  it("throws if a daily array is shorter than daily.time (a malformed upstream response)", () => {
    const base = makeRawResponse();
    const raw = {
      ...base,
      daily: { ...base.daily, temperature_2m_max: base.daily.temperature_2m_max.slice(0, 3) },
    };

    expect(() => mapForecastResponse(raw)).toThrow(/missing data for 2026-09-28/);
  });
});
