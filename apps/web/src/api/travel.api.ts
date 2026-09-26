import { apiFetch } from "./http";
import type { City, WeatherReport } from "./types";

export function getCities(): Promise<City[]> {
  return apiFetch<City[]>("/api/cities");
}

export function getWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<WeatherReport> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  return apiFetch<WeatherReport>(`/api/weather?${params.toString()}`, { signal });
}
