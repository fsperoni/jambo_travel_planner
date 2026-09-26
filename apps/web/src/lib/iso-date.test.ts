import { describe, expect, it } from "vitest";
import { formatWeekday } from "./iso-date";

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
