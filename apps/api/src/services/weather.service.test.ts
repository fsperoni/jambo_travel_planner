import { describe, expect, it, vi } from "vitest";
import type { OpenMeteoClient } from "../clients/open-meteo/client.js";
import { ForecastDateOutOfRangeError } from "../errors/app-error.js";
import { createWeatherService, type DailyForecast, type WeatherReport } from "./weather.service.js";

function makeDay(date: string): DailyForecast {
  return {
    date,
    condition: { code: 3, label: "Overcast" },
    temperatureMax: 20,
    temperatureMin: 8,
    precipitationProbabilityMax: 10,
    sunrise: `${date}T07:00`,
    sunset: `${date}T19:00`,
  };
}

function makeReport(): WeatherReport {
  return {
    timezone: "America/Edmonton",
    localDate: "2026-09-25",
    allowedForecastDates: { min: "2026-09-25", max: "2026-09-30" },
    units: { temperature: "°C", windSpeed: "km/h", precipitationProbability: "%" },
    current: {
      observedAt: "2026-09-25T20:30",
      temperature: 13.4,
      feelsLike: 8.9,
      humidity: 40,
      windSpeed: 16.1,
      isDay: false,
      condition: { code: 2, label: "Partly cloudy" },
    },
    week: [
      makeDay("2026-09-25"),
      makeDay("2026-09-26"),
      makeDay("2026-09-27"),
      makeDay("2026-09-28"),
      makeDay("2026-09-29"),
      makeDay("2026-09-30"),
      makeDay("2026-10-01"),
    ],
  };
}

describe("weather service", () => {
  it("delegates to the injected Open-Meteo client with the given coordinates", async () => {
    const report = makeReport();
    const openMeteoClient: OpenMeteoClient = { getForecast: vi.fn().mockResolvedValue(report) };
    const service = createWeatherService({ openMeteoClient });

    const result = await service.getWeatherReport(51.0447, -114.0719);

    expect(openMeteoClient.getForecast).toHaveBeenCalledWith(51.0447, -114.0719);
    expect(result).toBe(report);
  });

  it("propagates a rejection from the client rather than swallowing it", async () => {
    const openMeteoClient: OpenMeteoClient = {
      getForecast: vi.fn().mockRejectedValue(new Error("upstream failed")),
    };
    const service = createWeatherService({ openMeteoClient });

    await expect(service.getWeatherReport(0, 0)).rejects.toThrow("upstream failed");
  });

  it("attaches selectedDay when the requested date matches a day in the report", async () => {
    const report = makeReport();
    const openMeteoClient: OpenMeteoClient = { getForecast: vi.fn().mockResolvedValue(report) };
    const service = createWeatherService({ openMeteoClient });

    const result = await service.getWeatherReport(51.0447, -114.0719, "2026-09-27");

    expect(result.selectedDay).toEqual(makeDay("2026-09-27"));
    // The rest of the report is untouched — selectedDay is additive.
    expect(result.week).toEqual(report.week);
  });

  it("accepts the lower boundary of allowedForecastDates (today)", async () => {
    const report = makeReport();
    const openMeteoClient: OpenMeteoClient = { getForecast: vi.fn().mockResolvedValue(report) };
    const service = createWeatherService({ openMeteoClient });

    const result = await service.getWeatherReport(0, 0, report.allowedForecastDates.min);

    expect(result.selectedDay?.date).toBe(report.allowedForecastDates.min);
  });

  it("accepts the upper boundary of allowedForecastDates (today + 5)", async () => {
    const report = makeReport();
    const openMeteoClient: OpenMeteoClient = { getForecast: vi.fn().mockResolvedValue(report) };
    const service = createWeatherService({ openMeteoClient });

    const result = await service.getWeatherReport(0, 0, report.allowedForecastDates.max);

    expect(result.selectedDay?.date).toBe(report.allowedForecastDates.max);
  });

  it("rejects a date one day before the allowed range with ForecastDateOutOfRangeError", async () => {
    const report = makeReport();
    const openMeteoClient: OpenMeteoClient = { getForecast: vi.fn().mockResolvedValue(report) };
    const service = createWeatherService({ openMeteoClient });

    await expect(service.getWeatherReport(0, 0, "2026-09-24")).rejects.toThrow(
      ForecastDateOutOfRangeError,
    );
  });

  it("rejects a date one day after the allowed range (today + 6, even though it's in `week`)", async () => {
    // "2026-10-01" is week[6] — a real day Open-Meteo returned — but the
    // *picker's* allowed range is only today..+5 (max), one day narrower
    // than the full 7-day week. This is the exact boundary the assignment
    // asks for: reachable data isn't the same as a selectable date.
    const report = makeReport();
    const openMeteoClient: OpenMeteoClient = { getForecast: vi.fn().mockResolvedValue(report) };
    const service = createWeatherService({ openMeteoClient });

    await expect(service.getWeatherReport(0, 0, "2026-10-01")).rejects.toThrow(
      ForecastDateOutOfRangeError,
    );
  });

  it("includes the allowed range in the thrown error's details", async () => {
    const report = makeReport();
    const openMeteoClient: OpenMeteoClient = { getForecast: vi.fn().mockResolvedValue(report) };
    const service = createWeatherService({ openMeteoClient });

    await expect(service.getWeatherReport(0, 0, "2026-10-01")).rejects.toMatchObject({
      details: { min: "2026-09-25", max: "2026-09-30" },
    });
  });
});
