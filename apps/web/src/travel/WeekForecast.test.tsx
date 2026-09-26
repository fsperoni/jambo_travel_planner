import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeekForecast } from "./WeekForecast";
import type { DailyForecast, WeatherReport } from "../api/types";

const units: WeatherReport["units"] = {
  temperature: "°C",
  windSpeed: "km/h",
  precipitationProbability: "%",
};

const days: DailyForecast[] = [
  {
    // 2026-09-25 is a Friday, but the first entry should always read
    // "Today" regardless of what day of the week it actually falls on.
    date: "2026-09-25",
    condition: { code: 3, label: "Overcast" },
    temperatureMax: 23.1,
    temperatureMin: 7,
    precipitationProbabilityMax: 7,
    sunrise: "2026-09-25T07:27",
    sunset: "2026-09-25T19:27",
  },
  {
    date: "2026-09-26",
    condition: { code: 53, label: "Moderate drizzle" },
    temperatureMax: 12.7,
    temperatureMin: 3.9,
    precipitationProbabilityMax: 15,
    sunrise: "2026-09-26T07:29",
    sunset: "2026-09-26T19:24",
  },
];

describe("WeekForecast", () => {
  it("labels the first day 'Today' and later days by weekday name", () => {
    render(<WeekForecast days={days} units={units} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
  });

  it("rounds each day's high and low temperature", () => {
    render(<WeekForecast days={days} units={units} />);

    expect(screen.getByText("23°C")).toBeInTheDocument();
    expect(screen.getByText("7°C")).toBeInTheDocument();
  });

  it("is labelled for assistive tech as the 7-day forecast region", () => {
    render(<WeekForecast days={days} units={units} />);

    expect(screen.getByLabelText("7-day forecast")).toBeInTheDocument();
  });

  it("names each day's condition, for a mouse tooltip and for screen readers", () => {
    // The icon alone doesn't reliably communicate "Overcast" vs "Moderate
    // drizzle" vs any other condition at this size — this is the one place
    // that meaning is actually spelled out, since the icon itself stays
    // decorative (aria-hidden) rather than relying on ARIA support for
    // labelling an inline SVG.
    render(<WeekForecast days={days} units={units} />);

    expect(screen.getByTitle("Overcast")).toBeInTheDocument();
    expect(screen.getByTitle("Moderate drizzle")).toBeInTheDocument();
    expect(screen.getByText("Overcast")).toBeInTheDocument();
    expect(screen.getByText("Moderate drizzle")).toBeInTheDocument();
  });
});
