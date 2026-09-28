import { renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API_BASE_URL } from "../api/http";
import { server } from "../test/msw/server";
import { useCityDescription } from "./useCityDescription";

const SLOW_TITLE = "Slow_City";
const FAST_TITLE = "Fast_City";

function makeDescription(marker: string) {
  return {
    title: marker,
    description: `Description for ${marker}`,
    sourceUrl: `https://en.wikipedia.org/wiki/${marker}`,
  };
}

describe("useCityDescription", () => {
  it("returns null description and does not fetch when the title is null", () => {
    const { result } = renderHook(() => useCityDescription(null));

    expect(result.current.cityDescription).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches the description for the given title", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/city-description`, () =>
        HttpResponse.json(makeDescription("Calgary")),
      ),
    );

    const { result } = renderHook(() => useCityDescription("Calgary"));

    await waitFor(() => expect(result.current.cityDescription?.title).toBe("Calgary"));
    expect(result.current.error).toBeNull();
  });

  it("discards a slower, earlier request's result when a newer one has already resolved", async () => {
    // Same race useCityData guards against: the user picks city A (slow to
    // respond), then quickly picks city B (fast) before A's response
    // arrives. Without AbortController-based cancellation, A's late
    // response would overwrite B's already-displayed description.
    server.use(
      http.get(`${API_BASE_URL}/api/city-description`, async ({ request }) => {
        const url = new URL(request.url);
        const isSlowTitle = url.searchParams.get("title") === SLOW_TITLE;
        if (isSlowTitle) {
          await delay(50);
          return HttpResponse.json(makeDescription("slow-city-response"));
        }
        return HttpResponse.json(makeDescription("fast-city-response"));
      }),
    );

    const { result, rerender } = renderHook(({ title }) => useCityDescription(title), {
      initialProps: { title: SLOW_TITLE as string | null },
    });

    // Switch to the fast city immediately, before the slow request settles.
    rerender({ title: FAST_TITLE });

    await waitFor(() => expect(result.current.cityDescription?.title).toBe("fast-city-response"));

    // Give the slow (now-stale) request time to resolve too, then confirm
    // it didn't clobber the fast city's already-displayed result.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.cityDescription?.title).toBe("fast-city-response");
  });

  it("surfaces an error message when the request fails", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/city-description`, () =>
        HttpResponse.json(
          { error: { code: "UPSTREAM_ERROR", message: "Wikipedia is unavailable" } },
          { status: 502 },
        ),
      ),
    );

    const { result } = renderHook(() => useCityDescription("Calgary"));

    await waitFor(() => expect(result.current.error).toBe("Wikipedia is unavailable"));
    expect(result.current.cityDescription).toBeNull();
  });

  it("retry() re-fetches for the same title", async () => {
    let callCount = 0;
    server.use(
      http.get(`${API_BASE_URL}/api/city-description`, () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json(
            { error: { code: "UPSTREAM_ERROR", message: "fail" } },
            { status: 502 },
          );
        }
        return HttpResponse.json(makeDescription("recovered"));
      }),
    );

    const { result } = renderHook(() => useCityDescription("Calgary"));
    await waitFor(() => expect(result.current.error).toBe("fail"));

    result.current.retry();

    await waitFor(() => expect(result.current.cityDescription?.title).toBe("recovered"));
    expect(result.current.error).toBeNull();
  });
});
