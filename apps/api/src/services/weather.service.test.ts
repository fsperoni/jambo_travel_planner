import { describe, expect, it, vi } from "vitest";
import type { OpenMeteoClient } from "../clients/open-meteo/client.js";
import { createWeatherService } from "./weather.service.js";
import type { WeatherReport } from "../types/weather-report.js";
import { buildWeatherReport } from "../../test/helpers/fixtures.js";

describe("weather service", () => {
  it("delegates to the injected Open-Meteo client with the given coordinates and returns its report unchanged", async () => {
    const report: WeatherReport = buildWeatherReport();
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
