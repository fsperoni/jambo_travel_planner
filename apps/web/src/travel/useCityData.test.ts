import { renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API_BASE_URL } from "../api/http";
import { buildWeatherReport } from "../test/fixtures";
import { server } from "../test/msw/server";
import { useCityData } from "./useCityData";

const SLOW_CITY = { latitude: 1, longitude: 1 };
const FAST_CITY = { latitude: 2, longitude: 2 };

// `marker` stands in for whatever field a test needs to tell two responses
// apart (which city responded, which date was requested, etc.) — timezone
// is a convenient string field for that, not meaningful here otherwise.
function makeReport(marker: string) {
  return buildWeatherReport({ timezone: marker });
}

describe("useCityData", () => {
  it("returns null weather and does not fetch when coordinates are null", () => {
    const { result } = renderHook(() => useCityData(null, null));

    expect(result.current.weather).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches weather for the given coordinates", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/weather`, () =>
        HttpResponse.json(makeReport("America/Edmonton")),
      ),
    );

    const { result } = renderHook(() => useCityData(51.05, -114.07));

    await waitFor(() => expect(result.current.weather?.timezone).toBe("America/Edmonton"));
    expect(result.current.error).toBeNull();
  });

  it("discards a slower, earlier request's result when a newer one has already resolved", async () => {
    // Simulates the exact race a city switch can cause: the user picks
    // city A (slow to respond), then quickly picks city B (fast) before
    // A's response arrives. Without AbortController-based cancellation,
    // A's late response would overwrite B's already-displayed weather
    // with stale data for a city the user isn't looking at anymore.
    server.use(
      http.get(`${API_BASE_URL}/api/weather`, async ({ request }) => {
        const url = new URL(request.url);
        const isSlowCity = url.searchParams.get("latitude") === String(SLOW_CITY.latitude);
        if (isSlowCity) {
          await delay(50);
          return HttpResponse.json(makeReport("slow-city-response"));
        }
        return HttpResponse.json(makeReport("fast-city-response"));
      }),
    );

    const { result, rerender } = renderHook(({ lat, lon }) => useCityData(lat, lon), {
      initialProps: {
        lat: SLOW_CITY.latitude as number | null,
        lon: SLOW_CITY.longitude as number | null,
      },
    });

    // Switch to the fast city immediately, before the slow request settles.
    rerender({ lat: FAST_CITY.latitude, lon: FAST_CITY.longitude });

    await waitFor(() => expect(result.current.weather?.timezone).toBe("fast-city-response"));

    // Give the slow (now-stale) request time to resolve too, then confirm
    // it didn't clobber the fast city's already-displayed result.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.weather?.timezone).toBe("fast-city-response");
  });

  it("surfaces an error message when the request fails", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/weather`, () =>
        HttpResponse.json(
          { error: { code: "UPSTREAM_ERROR", message: "Weather is unavailable" } },
          { status: 502 },
        ),
      ),
    );

    const { result } = renderHook(() => useCityData(51.05, -114.07));

    await waitFor(() => expect(result.current.error).toBe("Weather is unavailable"));
    expect(result.current.weather).toBeNull();
  });

  it("retry() re-fetches for the same coordinates", async () => {
    let callCount = 0;
    server.use(
      http.get(`${API_BASE_URL}/api/weather`, () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json(
            { error: { code: "UPSTREAM_ERROR", message: "fail" } },
            { status: 502 },
          );
        }
        return HttpResponse.json(makeReport("recovered"));
      }),
    );

    const { result } = renderHook(() => useCityData(51.05, -114.07));
    await waitFor(() => expect(result.current.error).toBe("fail"));

    result.current.retry();

    await waitFor(() => expect(result.current.weather?.timezone).toBe("recovered"));
    expect(result.current.error).toBeNull();
  });

  it("passes the date through to the request and re-fetches when it changes", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/weather`, ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date");
        return HttpResponse.json(makeReport(date ?? "no-date"));
      }),
    );

    const { result, rerender } = renderHook(
      ({ date }: { date: string | null }) => useCityData(51.05, -114.07, date),
      { initialProps: { date: null as string | null } },
    );

    await waitFor(() => expect(result.current.weather?.timezone).toBe("no-date"));

    rerender({ date: "2026-09-29" });

    await waitFor(() => expect(result.current.weather?.timezone).toBe("2026-09-29"));
  });

  it("exposes the error's code alongside its message", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/weather`, () =>
        HttpResponse.json(
          {
            error: {
              code: "FORECAST_DATE_OUT_OF_RANGE",
              message: "date must be between 2026-09-27 and 2026-10-02",
              details: { min: "2026-09-27", max: "2026-10-02" },
            },
          },
          { status: 400 },
        ),
      ),
    );

    const { result } = renderHook(() => useCityData(51.05, -114.07, "2026-10-05"));

    await waitFor(() => expect(result.current.errorCode).toBe("FORECAST_DATE_OUT_OF_RANGE"));
    expect(result.current.error).toBe("date must be between 2026-09-27 and 2026-10-02");
  });

  it("clears the previous error code once a request succeeds", async () => {
    let callCount = 0;
    server.use(
      http.get(`${API_BASE_URL}/api/weather`, () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json(
            { error: { code: "FORECAST_DATE_OUT_OF_RANGE", message: "out of range" } },
            { status: 400 },
          );
        }
        return HttpResponse.json(makeReport("recovered"));
      }),
    );

    const { result } = renderHook(() => useCityData(51.05, -114.07, "2026-10-05"));
    await waitFor(() => expect(result.current.errorCode).toBe("FORECAST_DATE_OUT_OF_RANGE"));

    result.current.retry();

    await waitFor(() => expect(result.current.weather?.timezone).toBe("recovered"));
    expect(result.current.errorCode).toBeNull();
  });
});
