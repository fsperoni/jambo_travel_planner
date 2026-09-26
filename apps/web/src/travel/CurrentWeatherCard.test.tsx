import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrentWeatherCard } from "./CurrentWeatherCard";
import type { CurrentWeather, WeatherReport } from "../api/types";

const units: WeatherReport["units"] = {
  temperature: "°C",
  windSpeed: "km/h",
  precipitationProbability: "%",
};

const current: CurrentWeather = {
  observedAt: "2026-09-25T20:30",
  temperature: 13.4,
  feelsLike: 8.6,
  humidity: 41,
  windSpeed: 14.1,
  isDay: false,
  condition: { code: 1, label: "Mainly clear" },
};

describe("CurrentWeatherCard", () => {
  it("rounds and labels the temperature, condition, and details", () => {
    render(<CurrentWeatherCard current={current} units={units} />);

    expect(screen.getByText("13°C")).toBeInTheDocument();
    expect(screen.getByText("Mainly clear")).toBeInTheDocument();
    expect(screen.getByText("9°C")).toBeInTheDocument(); // feels-like, rounded
    expect(screen.getByText("41%")).toBeInTheDocument();
    expect(screen.getByText("14 km/h")).toBeInTheDocument();
  });

  it("is labelled for assistive tech as the current-weather region", () => {
    render(<CurrentWeatherCard current={current} units={units} />);

    expect(screen.getByLabelText("Current weather")).toBeInTheDocument();
  });
});
