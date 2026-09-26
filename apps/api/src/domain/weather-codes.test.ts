import { describe, expect, it } from "vitest";
import { describeWeatherCode } from "./weather-codes.js";

describe("describeWeatherCode", () => {
  it("returns the documented label for a known WMO code", () => {
    expect(describeWeatherCode(0)).toEqual({ code: 0, label: "Clear sky" });
    expect(describeWeatherCode(61)).toEqual({ code: 61, label: "Slight rain" });
    expect(describeWeatherCode(95)).toEqual({ code: 95, label: "Thunderstorm" });
  });

  it("falls back to 'Unknown' for an undocumented code, rather than throwing", () => {
    expect(describeWeatherCode(9999)).toEqual({ code: 9999, label: "Unknown" });
  });
});
