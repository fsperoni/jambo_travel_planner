import { describe, expect, it } from "vitest";
import { CITY_CATALOGUE, findCityById, listCities } from "./city-catalogue.js";

describe("city catalogue", () => {
  it("has a unique id for every city", () => {
    const ids = CITY_CATALOGUE.map((city) => city.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a valid latitude/longitude for every city", () => {
    for (const city of CITY_CATALOGUE) {
      expect(city.latitude).toBeGreaterThanOrEqual(-90);
      expect(city.latitude).toBeLessThanOrEqual(90);
      expect(city.longitude).toBeGreaterThanOrEqual(-180);
      expect(city.longitude).toBeLessThanOrEqual(180);
    }
  });

  it("has a non-empty name, a 2-letter countryCode, and a wikipediaTitle for every city", () => {
    for (const city of CITY_CATALOGUE) {
      expect(city.name.length).toBeGreaterThan(0);
      expect(city.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(city.wikipediaTitle.length).toBeGreaterThan(0);
    }
  });

  it("listCities returns a fresh copy, not the live catalogue reference", () => {
    const cities = listCities();
    cities.push({
      id: "fake",
      name: "Fake",
      countryCode: "XX",
      latitude: 0,
      longitude: 0,
      wikipediaTitle: "Fake",
    });

    expect(listCities()).toHaveLength(CITY_CATALOGUE.length);
  });

  it("findCityById finds an existing city by id", () => {
    expect(findCityById("calgary")?.name).toBe("Calgary");
  });

  it("findCityById returns undefined for an unknown id", () => {
    expect(findCityById("does-not-exist")).toBeUndefined();
  });
});
