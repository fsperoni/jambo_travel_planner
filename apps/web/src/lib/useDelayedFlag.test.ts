import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedFlag } from "./useDelayedFlag";

describe("useDelayedFlag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays false before the delay elapses", () => {
    const { result } = renderHook(({ active }) => useDelayedFlag(active, 1000), {
      initialProps: { active: true },
    });

    act(() => vi.advanceTimersByTime(999));

    expect(result.current).toBe(false);
  });

  it("becomes true once the delay elapses while still active", () => {
    const { result } = renderHook(({ active }) => useDelayedFlag(active, 1000), {
      initialProps: { active: true },
    });

    act(() => vi.advanceTimersByTime(1000));

    expect(result.current).toBe(true);
  });

  it("resets to false as soon as active becomes false", () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 1000), {
      initialProps: { active: true },
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);

    rerender({ active: false });

    expect(result.current).toBe(false);
  });

  it("never fires if active goes false before the delay elapses", () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 1000), {
      initialProps: { active: true },
    });
    act(() => vi.advanceTimersByTime(500));

    rerender({ active: false });
    act(() => vi.advanceTimersByTime(1000));

    expect(result.current).toBe(false);
  });

  it("starts false when active is false from the start", () => {
    const { result } = renderHook(({ active }) => useDelayedFlag(active, 1000), {
      initialProps: { active: false },
    });

    expect(result.current).toBe(false);
  });
});
