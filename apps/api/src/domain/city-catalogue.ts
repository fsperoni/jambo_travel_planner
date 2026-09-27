export interface City {
  id: string;
  name: string;
  region?: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  /** The exact Wikipedia article title for this city, used by the
   *  description feature (Stage 5) — curated by hand so e.g. "New York
   *  City" resolves correctly rather than guessing from `name` alone. */
  wikipediaTitle: string;
}

// A small, static, read-only list — see the README's "Database / migrations"
// section for why this is a typed constant rather than a database table.
// Coordinates are each city's commonly-used downtown/city-centre point.
export const CITY_CATALOGUE: readonly City[] = [
  {
    id: "calgary",
    name: "Calgary",
    region: "Alberta",
    countryCode: "CA",
    latitude: 51.0447,
    longitude: -114.0719,
    wikipediaTitle: "Calgary",
  },
  {
    id: "vancouver",
    name: "Vancouver",
    region: "British Columbia",
    countryCode: "CA",
    latitude: 49.2827,
    longitude: -123.1207,
    wikipediaTitle: "Vancouver",
  },
  {
    id: "toronto",
    name: "Toronto",
    region: "Ontario",
    countryCode: "CA",
    latitude: 43.6532,
    longitude: -79.3832,
    wikipediaTitle: "Toronto",
  },
  {
    id: "new-york-city",
    name: "New York City",
    region: "New York",
    countryCode: "US",
    latitude: 40.7128,
    longitude: -74.006,
    wikipediaTitle: "New York City",
  },
  {
    id: "london",
    name: "London",
    countryCode: "GB",
    latitude: 51.5074,
    longitude: -0.1278,
    wikipediaTitle: "London",
  },
  {
    id: "paris",
    name: "Paris",
    countryCode: "FR",
    latitude: 48.8566,
    longitude: 2.3522,
    wikipediaTitle: "Paris",
  },
  {
    id: "sibenik",
    name: "Šibenik",
    countryCode: "HR",
    latitude: 43.735,
    longitude: 15.8952,
    // Deliberately includes a diacritic (the "Š") — the exact canonical
    // title Wikipedia uses. Confirmed against the real API rather than
    // assumed: encodeURIComponent() percent-encodes any Unicode character,
    // not just ASCII, so a non-ASCII title needs no special-casing in
    // clients/wikipedia/client.ts. See AI_USAGE.md for the verification.
    wikipediaTitle: "Šibenik",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    countryCode: "JP",
    latitude: 35.6762,
    longitude: 139.6503,
    wikipediaTitle: "Tokyo",
  },
  {
    id: "sydney",
    name: "Sydney",
    region: "New South Wales",
    countryCode: "AU",
    latitude: -33.8688,
    longitude: 151.2093,
    wikipediaTitle: "Sydney",
  },
  {
    id: "sao-paulo",
    name: "São Paulo",
    region: "São Paulo",
    countryCode: "BR",
    latitude: -23.5505,
    longitude: -46.6333,
    wikipediaTitle: "São Paulo",
  },
  {
    id: "nairobi",
    name: "Nairobi",
    countryCode: "KE",
    latitude: -1.2921,
    longitude: 36.8219,
    wikipediaTitle: "Nairobi",
  },
] as const;

export function listCities(): City[] {
  return [...CITY_CATALOGUE];
}

export function findCityById(id: string): City | undefined {
  return CITY_CATALOGUE.find((city) => city.id === id);
}
