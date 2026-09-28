import { describe, expect, it } from "vitest";
import {
  CITY_CATALOGUE,
  findCityByNameAndCountry,
  findCityById,
  listCities,
} from "./city-catalogue.js";

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

  it("listCities returns cities sorted alphabetically by name", () => {
    const names = listCities().map((city) => city.name);
    const expected = [...names].sort((a, b) => a.localeCompare(b));

    expect(names).toEqual(expected);
    // Confirms this isn't a vacuous check against CITY_CATALOGUE's own
    // (non-alphabetical) declaration order.
    expect(names).not.toEqual(CITY_CATALOGUE.map((city) => city.name));
  });

  it("sorts a diacritic city into its expected alphabetical position, not after Z", () => {
    const names = listCities().map((city) => city.name);
    const sibenikIndex = names.indexOf("Šibenik");
    const sydneyIndex = names.indexOf("Sydney");

    expect(sibenikIndex).toBeGreaterThan(-1);
    expect(sibenikIndex).toBeLessThan(sydneyIndex);
  });

  it("findCityById finds an existing city by id", () => {
    expect(findCityById("calgary")?.name).toBe("Calgary");
  });

  it("findCityById returns undefined for an unknown id", () => {
    expect(findCityById("does-not-exist")).toBeUndefined();
  });

  it("findCityByNameAndCountry matches an exact name and country code", () => {
    expect(findCityByNameAndCountry("Calgary", "CA")?.id).toBe("calgary");
  });

  it("findCityByNameAndCountry matches despite a missing diacritic, different case, or padding", () => {
    expect(findCityByNameAndCountry("sao paulo", "br")?.id).toBe("sao-paulo");
    expect(findCityByNameAndCountry("  Sibenik  ", "HR")?.id).toBe("sibenik");
  });

  it("findCityByNameAndCountry does not match a same-named city in a different country", () => {
    expect(findCityByNameAndCountry("Calgary", "US")).toBeUndefined();
  });

  it("findCityByNameAndCountry returns undefined for a city not in the catalogue", () => {
    expect(findCityByNameAndCountry("Atlantis", "XX")).toBeUndefined();
  });
});
