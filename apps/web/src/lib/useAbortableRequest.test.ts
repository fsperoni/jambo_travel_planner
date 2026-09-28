import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http";
import { useAbortableRequest } from "./useAbortableRequest";

// useCityData.test.ts and useCityDescription.test.ts already exercise this
// hook indirectly (both are thin wrappers over it — see the Architecture
// overview section of the README) through MSW-mocked fetches, including
// the "slower request superseded by a faster one" race. This file tests
// the hook directly instead, with a hand-controlled `request` function —
// needed specifically to exercise the success-path abort guard below,
// which a real MSW-backed fetch can't trigger: MSW respects a real
// AbortSignal and rejects an aborted request, so it never reaches the
// success path at all. A `request` function that ignores its own signal
// (a case this hook has to defend against regardless) is the only way to
// reproduce the specific race this guard exists for.
describe("useAbortableRequest", () => {
  it("returns null data and does not call request when key is null", () => {
    const request = vi.fn();

    const { result } = renderHook(() => useAbortableRequest<string>(null, request));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("calls request for the given key and stores its result", async () => {
    const request = vi.fn().mockResolvedValue("hello");

    const { result } = renderHook(() => useAbortableRequest<string>("a", request));

    await waitFor(() => expect(result.current.data).toBe("hello"));
    expect(result.current.isLoading).toBe(false);
    expect(request).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("surfaces an ApiError's message and code", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new ApiError(502, "UPSTREAM_ERROR", "Weather is unavailable"));

    const { result } = renderHook(() => useAbortableRequest<string>("a", request));

    await waitFor(() => expect(result.current.error).toBe("Weather is unavailable"));
    expect(result.current.errorCode).toBe("UPSTREAM_ERROR");
    expect(result.current.data).toBeNull();
  });

  it("falls back to the generic error message for a non-ApiError failure", async () => {
    const request = vi.fn().mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useAbortableRequest<string>("a", request));

    await waitFor(() =>
      expect(result.current.error).toBe("Something went wrong. Please try again."),
    );
    expect(result.current.errorCode).toBeNull();
  });

  it("retry() re-invokes request for the same key", async () => {
    let callCount = 0;
    const request = vi.fn(() => {
      callCount += 1;
      return callCount === 1 ? Promise.reject(new Error("fail")) : Promise.resolve("recovered");
    });

    const { result } = renderHook(() => useAbortableRequest<string>("a", request));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    result.current.retry();

    await waitFor(() => expect(result.current.data).toBe("recovered"));
    expect(result.current.error).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("discards a result that resolves after its request was superseded, even when `request` itself never checks its own abort signal", async () => {
    // The catch-path guard (controller.signal.aborted, checked before
    // setError) already existed; this is what proves the success path
    // needed the same guard, not just the failure path. A request
    // function that ignores the signal it's handed (e.g. a fetch already
    // in flight with no way to actually cancel it mid-request) can still
    // resolve well after being superseded — without this hook's own
    // check, that stale resolution would silently overwrite the newer,
    // already-displayed data.
    let resolveFirst!: (value: string) => void;
    const request = vi.fn((_signal: AbortSignal) => {
      if (request.mock.calls.length === 1) {
        return new Promise<string>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve("second-result");
    });

    const { result, rerender } = renderHook(
      ({ key }) => useAbortableRequest<string>(key, request),
      {
        initialProps: { key: "first" },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    rerender({ key: "second" });
    await waitFor(() => expect(result.current.data).toBe("second-result"));

    // The first request finally resolves, well after being superseded —
    // this is exactly the resolution the success-path guard exists to
    // discard.
    resolveFirst("first-result (stale)");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.data).toBe("second-result");
  });
});
