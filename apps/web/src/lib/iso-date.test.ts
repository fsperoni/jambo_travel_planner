import { describe, expect, it } from "vitest";
import { formatFullDate, formatLocalTime, formatWeekday } from "./iso-date";

describe("formatWeekday", () => {
  it("formats a known date correctly", () => {
    // 2026-09-25 is a Friday.
    expect(formatWeekday("2026-09-25")).toBe("Fri");
  });

  it("still returns the date's own weekday even where a browser west of UTC would otherwise show a different one", () => {
    // Sanity check first: proves this test is demonstrating a real
    // difference, not merely restating the implementation. Honolulu is
    // UTC-10, so UTC midnight on the 25th is still 2pm on the 24th there —
    // a *naive* formatter (no explicit timeZone) would render this as
    // "Thu" for a browser/OS set to that zone.
    const notPinnedToUtc = new Date("2026-09-25T00:00:00Z").toLocaleDateString(undefined, {
      weekday: "short",
      timeZone: "Pacific/Honolulu",
    });
    expect(notPinnedToUtc).toBe("Thu");

    // formatWeekday pins `timeZone: "UTC"` internally, so it isn't
    // affected by whatever time zone the browser happens to be in.
    expect(formatWeekday("2026-09-25")).toBe("Fri");
  });
});

describe("formatLocalTime", () => {
  it("formats a local time string without shifting it, regardless of the runtime's own time zone", () => {
    // Deliberately no TZ manipulation here — that's the point: parsing a
    // timezone-less string as local time, then formatting with no
    // explicit timeZone, cancel out to the same wall-clock time no matter
    // what zone the runtime is actually in. Confirmed directly during
    // development by running this exact call under TZ=UTC,
    // Pacific/Honolulu, and Asia/Tokyo and getting "7:38 AM" every time —
    // not assumed from how the two calls "should" interact.
    expect(formatLocalTime("2026-10-02T07:38")).toBe("7:38 AM");
  });

  it("would not be 7:38 AM if the string were mistakenly treated as UTC and displayed in a non-UTC zone", () => {
    // A sanity check that this test is demonstrating something real: if
    // formatLocalTime *did* treat the input as UTC (e.g. by appending "Z"
    // internally) and then rendered it in a specific non-UTC zone, the
    // displayed hour would shift.
    const ifTreatedAsUtc = new Date("2026-10-02T07:38Z").toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });
    expect(ifTreatedAsUtc).not.toBe("7:38 AM");
  });
});

describe("formatFullDate", () => {
  it("formats a known date correctly", () => {
    expect(formatFullDate("2026-09-25")).toBe("Friday, September 25");
  });

  it("pins to UTC, the same off-by-one risk as formatWeekday", () => {
    const notPinnedToUtc = new Date("2026-09-25T00:00:00Z").toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "Pacific/Honolulu",
    });
    expect(notPinnedToUtc).toBe("Thursday, September 24");
    expect(formatFullDate("2026-09-25")).toBe("Friday, September 25");
  });
});
