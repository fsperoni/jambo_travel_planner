import { describe, expect, it } from "vitest";
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudLightning } from "lucide-react";
import { getWeatherIcon } from "./weather-icons";

describe("getWeatherIcon", () => {
  it("returns Sun for clear sky during the day", () => {
    expect(getWeatherIcon(0, true)).toBe(Sun);
  });

  it("returns Moon for clear sky at night", () => {
    expect(getWeatherIcon(0, false)).toBe(Moon);
  });

  it("returns CloudSun/CloudMoon for mainly-clear/partly-cloudy, by time of day", () => {
    expect(getWeatherIcon(1, true)).toBe(CloudSun);
    expect(getWeatherIcon(2, false)).toBe(CloudMoon);
  });

  it("defaults to the daytime icon when isDay is omitted", () => {
    expect(getWeatherIcon(0)).toBe(Sun);
  });

  it("maps a thunderstorm code regardless of time of day", () => {
    expect(getWeatherIcon(95, true)).toBe(CloudLightning);
    expect(getWeatherIcon(95, false)).toBe(CloudLightning);
  });

  it("falls back to a plain Cloud icon for an undocumented code", () => {
    expect(getWeatherIcon(9999)).toBe(Cloud);
  });
});
