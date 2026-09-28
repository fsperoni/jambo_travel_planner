import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { DetectedLocation } from "../api/types";
import { API_BASE_URL, GENERIC_ERROR_MESSAGE } from "../api/http";
import { MOCK_CITIES, buildWeatherReport } from "../test/fixtures";
import { server } from "../test/msw/server";
import { TravelPlannerPage } from "./TravelPlannerPage";

// A thin, file-local convenience over the shared buildWeatherReport: most
// tests below only care about a specific temperature/condition (to tell
// two cities' responses apart on screen), not the rest of the report.
function reportWith(temperature: number, conditionLabel: string) {
  return buildWeatherReport({
    timezone: "UTC",
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
  });
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

    // Defaults to the first city in the catalogue (Calgary) when location
    // detection reports "local-development" — see MOCK_LOCATION.
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
          { error: { code: "INTERNAL_ERROR", message: GENERIC_ERROR_MESSAGE } },
          { status: 500 },
        ),
      ),
    );

    render(<TravelPlannerPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC_ERROR_MESSAGE);
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

  it("lets the user pick a forecast date and shows the selected-day card", async () => {
    const selectedDay = {
      date: "2026-09-29",
      condition: { code: 3, label: "Overcast" },
      temperatureMax: 15,
      temperatureMin: 5,
      precipitationProbabilityMax: 20,
      sunrise: "2026-09-29T07:00",
      sunset: "2026-09-29T19:00",
    };

    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)),
      http.get(`${API_BASE_URL}/api/weather`, ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date");
        return HttpResponse.json({
          ...buildWeatherReport({
            timezone: "UTC",
            current: {
              observedAt: "2026-09-25T12:00",
              temperature: 10,
              feelsLike: 11,
              humidity: 50,
              windSpeed: 10,
              isDay: true,
              condition: { code: 0, label: "Clear" },
            },
            week: [selectedDay],
          }),
          ...(date === selectedDay.date ? { selectedDay } : {}),
        });
      }),
    );

    const user = userEvent.setup();
    render(<TravelPlannerPage />);

    const datePicker = await screen.findByLabelText("See forecast for a specific day");
    expect(screen.queryByLabelText(/Forecast for/)).not.toBeInTheDocument();

    await user.type(datePicker, selectedDay.date);

    const selectedDayCard = await screen.findByLabelText("Forecast for Tuesday, September 29");
    // "15°C" also appears in the (still-rendered) week strip for the same
    // day, so this scopes the assertion to the selected-day card
    // specifically rather than asserting on ambiguous page-wide text.
    expect(within(selectedDayCard).getByText("15°C")).toBeInTheDocument();
  });

  it("clears the selected date when switching to a different city, and doesn't request a forecast for any date until one is chosen again", async () => {
    // A forecast date is a choice about *this* city's calendar — carrying
    // it over to a new city (even one where it happened to still be valid)
    // would be surprising, so a city change always resets to "current +
    // week only" and requires the user to pick a date again.
    const weatherRequests: Array<string | null> = [];
    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)),
      http.get(`${API_BASE_URL}/api/weather`, ({ request }) => {
        const date = new URL(request.url).searchParams.get("date");
        weatherRequests.push(date);
        return HttpResponse.json(reportWith(10, "Clear"));
      }),
    );

    const user = userEvent.setup();
    render(<TravelPlannerPage />);

    const datePicker = await screen.findByLabelText("See forecast for a specific day");
    await user.type(datePicker, "2026-09-29");
    await expect(datePicker).toHaveValue("2026-09-29");

    await user.selectOptions(screen.getByRole("combobox", { name: "City" }), "tokyo");

    // Re-queried inside waitFor, not the earlier `datePicker` reference —
    // the weather section (including this input) unmounts while Tokyo's
    // data is loading, so a captured element goes stale across that gap.
    await waitFor(() => {
      expect(screen.getByLabelText("See forecast for a specific day")).toHaveValue("");
    });
    expect(screen.queryByLabelText(/Forecast for/)).not.toBeInTheDocument();
    // The city-switch request itself must not carry the old city's date —
    // confirms the date is cleared *before* the new request goes out, not
    // just that the UI resets after the fact.
    expect(weatherRequests.at(-1)).toBeNull();
  });

  it("recovers from a date that's no longer valid for the same city, without a city change", async () => {
    // The city-change case above clears the date proactively; this covers
    // the one remaining path to an out-of-range date: the allowed range
    // shifting for the *same* city (e.g. time passing) between one weather
    // fetch and the next.
    let callCount = 0;
    server.use(
      http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES)),
      http.get(`${API_BASE_URL}/api/weather`, ({ request }) => {
        const date = new URL(request.url).searchParams.get("date");
        callCount += 1;
        if (date && callCount > 1) {
          return HttpResponse.json(
            {
              error: {
                code: "FORECAST_DATE_OUT_OF_RANGE",
                message: "date must be between 2026-09-26 and 2026-10-01",
                details: { min: "2026-09-26", max: "2026-10-01" },
              },
            },
            { status: 400 },
          );
        }
        return HttpResponse.json(reportWith(10, "Clear"));
      }),
    );

    const user = userEvent.setup();
    render(<TravelPlannerPage />);

    const datePicker = await screen.findByLabelText("See forecast for a specific day");
    await user.type(datePicker, "2026-09-29");

    // Re-queried inside waitFor — same stale-reference reasoning as above.
    await waitFor(() => {
      expect(screen.getByLabelText("See forecast for a specific day")).toHaveValue("");
    });
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
