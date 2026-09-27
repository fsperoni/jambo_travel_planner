import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DailyForecast, WeatherReport } from "../api/types";
import { SelectedDayCard } from "./SelectedDayCard";

const day: DailyForecast = {
  date: "2026-10-02",
  condition: { code: 3, label: "Overcast" },
  temperatureMax: 13.2,
  temperatureMin: 3.1,
  precipitationProbabilityMax: 7,
  sunrise: "2026-10-02T07:38",
  sunset: "2026-10-02T19:11",
};

const units: WeatherReport["units"] = {
  temperature: "°C",
  windSpeed: "km/h",
  precipitationProbability: "%",
};

describe("SelectedDayCard", () => {
  it("shows the full date, rounded high/low temperatures, and the condition label", () => {
    render(<SelectedDayCard day={day} units={units} />);

    expect(screen.getByText("Friday, October 2")).toBeInTheDocument();
    expect(screen.getByText("13°C")).toBeInTheDocument();
    expect(screen.getByText("3°C")).toBeInTheDocument();
    expect(screen.getByText("Overcast")).toBeInTheDocument();
  });

  it("shows precipitation chance and sunrise/sunset as local wall-clock times", () => {
    render(<SelectedDayCard day={day} units={units} />);

    expect(screen.getByText("7%")).toBeInTheDocument();
    expect(screen.getByText("7:38 AM")).toBeInTheDocument();
    expect(screen.getByText("7:11 PM")).toBeInTheDocument();
  });

  it("is labelled for assistive tech with the full date", () => {
    render(<SelectedDayCard day={day} units={units} />);

    expect(screen.getByLabelText("Forecast for Friday, October 2")).toBeInTheDocument();
  });
});
