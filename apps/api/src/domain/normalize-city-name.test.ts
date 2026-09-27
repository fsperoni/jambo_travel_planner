import { describe, expect, it } from "vitest";
import { normalizeCityName } from "./normalize-city-name.js";

describe("normalizeCityName", () => {
  it("lowercases", () => {
    expect(normalizeCityName("Calgary")).toBe("calgary");
  });

  it("strips diacritics", () => {
    expect(normalizeCityName("São Paulo")).toBe("sao paulo");
    expect(normalizeCityName("Šibenik")).toBe("sibenik");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCityName("  Calgary  ")).toBe("calgary");
  });

  it("treats a diacritic and its plain-ASCII equivalent as equal", () => {
    expect(normalizeCityName("Sao Paulo")).toBe(normalizeCityName("São Paulo"));
    expect(normalizeCityName("sibenik")).toBe(normalizeCityName("Šibenik"));
  });
});
