import { describe, expect, it } from "vitest";
import { truncateAtWordBoundary } from "./truncate-text.js";

describe("truncateAtWordBoundary", () => {
  it("returns text unchanged when it's already within the limit", () => {
    expect(truncateAtWordBoundary("Calgary is a city.", 100)).toBe("Calgary is a city.");
  });

  it("returns text unchanged when it's exactly at the limit", () => {
    const text = "a".repeat(50);
    expect(truncateAtWordBoundary(text, 50)).toBe(text);
  });

  it("truncates at the last word boundary at or before the limit", () => {
    const text = "New York City is the most populous city in the United States.";
    const result = truncateAtWordBoundary(text, 20);

    // Not cut mid-word ("New York City is th…") — cut back to the last
    // full word that still fits.
    expect(result).toBe("New York City is…");
    expect(result.length).toBeLessThanOrEqual(21); // 20 + the ellipsis character
  });

  it("falls back to a hard cut when there's no space to break on", () => {
    const text = "a".repeat(100);
    const result = truncateAtWordBoundary(text, 20);

    expect(result).toBe(`${"a".repeat(20)}…`);
  });
});
