import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { DetectedLocation } from "../api/types";
import { MOCK_CITIES } from "../test/msw/handlers";
import { server } from "../test/msw/server";
import { TravelPlannerPage } from "./TravelPlannerPage";

const API_BASE_URL = "http://localhost:3000";

function reportWith(temperature: number, conditionLabel: string) {
  return {
    timezone: "UTC",
    localDate: "2026-09-25",
    allowedForecastDates: { min: "2026-09-25", max: "2026-09-30" },
    units: { temperature: "°C", windSpeed: "km/h", precipitationProbability: "%" },
    current: {
      observedAt: "2026-09-25T20:30",
      temperature,
      // Deliberately different from `temperature` — both render as "N°C"
      // on screen, and an identical value would make them ambiguous to
      // query for by text.
      feelsLike: temperature + 1,
      humidity: 50,
      windSpeed: 10,
      isDay: true,
      condition: { code: 0, label: conditionLabel },
    },
    week: [],
  };
}

describe("TravelPlannerPage", () => {
  it("loads the first city's weather by default, then replaces it when a different city is selected", async () => {
    const [calgary, tokyo] = MOCK_CITIES;
    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)),
      http.get(`${API_BASE_URL}/api/weather`, ({ request }) => {
        const url = new URL(request.url);
        const isTokyo = url.searchParams.get("latitude") === String(tokyo?.latitude);
        return HttpResponse.json(
          isTokyo ? reportWith(25, "Sunny in Tokyo") : reportWith(10, "Clear in Calgary"),
        );
      }),
    );

    const user = userEvent.setup();
    render(<TravelPlannerPage />);

    // Defaults to the first city in the catalogue (Calgary) until Stage 6
    // adds real IP-based detection.
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "City" })).toHaveValue(calgary?.id);
    });
    expect(await screen.findByText("Clear in Calgary")).toBeInTheDocument();
    expect(screen.getByText("10°C")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "City" }), "tokyo");

    // The *displayed weather* changes to match the newly selected city —
    // not just that the dropdown's value changed, but that switching
    // actually re-fetched and re-rendered for the new coordinates.
    expect(await screen.findByText("Sunny in Tokyo")).toBeInTheDocument();
    expect(screen.getByText("25°C")).toBeInTheDocument();
    expect(screen.queryByText("Clear in Calgary")).not.toBeInTheDocument();
  });

  it("shows an error state with a retry option when the city list fails to load", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
          { status: 500 },
        ),
      ),
    );

    render(<TravelPlannerPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows a weather-specific error with retry when the city list loads but weather fails", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)),
      http.get(`${API_BASE_URL}/api/weather`, () =>
        HttpResponse.json(
          { error: { code: "UPSTREAM_ERROR", message: "Weather is unavailable" } },
          { status: 502 },
        ),
      ),
    );

    render(<TravelPlannerPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Weather is unavailable");
    // The city selector itself still works even though weather failed —
    // one failure doesn't take down the whole page.
    expect(screen.getByRole("combobox", { name: "City" })).toBeInTheDocument();
  });

  it("selects the IP-detected city (already in the catalogue) and shows a 'detected' notice", async () => {
    const [, tokyo] = MOCK_CITIES;
    const detected: DetectedLocation = { city: tokyo!, source: "ip" };
    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)),
      http.get(`${API_BASE_URL}/api/location`, () => HttpResponse.json(detected)),
      http.get(`${API_BASE_URL}/api/weather`, () => HttpResponse.json(reportWith(25, "Sunny"))),
    );

    render(<TravelPlannerPage />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "City" })).toHaveValue("tokyo");
    });
    expect(screen.getByText("Detected from your IP")).toBeInTheDocument();
  });

  it("inserts a one-off dynamic city at the top of the list when the detected location isn't in the catalogue", async () => {
    const detected: DetectedLocation = {
      city: {
        id: "detected",
        name: "Okotoks",
        countryCode: "CA",
        latitude: 50.73,
        longitude: -113.98,
        wikipediaTitle: "Okotoks",
      },
      source: "ip",
    };
    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)),
      http.get(`${API_BASE_URL}/api/location`, () => HttpResponse.json(detected)),
      http.get(`${API_BASE_URL}/api/weather`, () => HttpResponse.json(reportWith(18, "Sunny"))),
    );

    render(<TravelPlannerPage />);

    const combobox = await screen.findByRole("combobox", { name: "City" });
    await waitFor(() => expect(combobox).toHaveValue("detected"));
    expect(screen.getByRole("option", { name: "Okotoks" })).toBeInTheDocument();
    expect(screen.getByText("Detected from your IP")).toBeInTheDocument();
  });

  it("shows a 'couldn't detect' notice, not an error, when location detection falls back to the default city", async () => {
    const [calgary] = MOCK_CITIES;
    const detected: DetectedLocation = {
      city: calgary!,
      source: "default",
      reason: "lookup-failed",
    };
    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)),
      http.get(`${API_BASE_URL}/api/location`, () => HttpResponse.json(detected)),
      http.get(`${API_BASE_URL}/api/weather`, () => HttpResponse.json(reportWith(10, "Clear"))),
    );

    render(<TravelPlannerPage />);

    expect(
      await screen.findByText("Couldn't detect your location, showing Calgary"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("falls back to the first catalogue city, with no notice or error, when the location endpoint itself fails", async () => {
    const [calgary] = MOCK_CITIES;
    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)),
      http.get(`${API_BASE_URL}/api/location`, () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "boom" } }, { status: 500 }),
      ),
      http.get(`${API_BASE_URL}/api/weather`, () => HttpResponse.json(reportWith(10, "Clear"))),
    );

    render(<TravelPlannerPage />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "City" })).toHaveValue(calgary?.id);
    });
    // Location detection is a nice-to-have default, not a hard requirement
    // — its own failure shouldn't surface as a visible error or notice.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the location notice once the user manually picks a different city", async () => {
    const user = userEvent.setup();
    server.use(http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)));

    render(<TravelPlannerPage />);

    expect(await screen.findByText(/local development/)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "City" }), "tokyo");

    expect(screen.queryByText(/local development/)).not.toBeInTheDocument();
  });
});
