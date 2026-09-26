import { describe, expect, it, vi } from "vitest";
import type { OpenMeteoClient } from "../clients/open-meteo/client.js";
import { createWeatherService, type WeatherReport } from "./weather.service.js";

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
    week: [],
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
});
