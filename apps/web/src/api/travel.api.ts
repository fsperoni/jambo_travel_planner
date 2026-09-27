import { apiFetch } from "./http";
import type { City, CityDescription, DetectedLocation, WeatherReport } from "./types";

export function getCities(): Promise<City[]> {
  return apiFetch<City[]>("/api/cities");
}

export function getWeather(
  latitude: number,
  longitude: number,
  date?: string,
  signal?: AbortSignal,
): Promise<WeatherReport> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  if (date) {
    params.set("date", date);
  }
  return apiFetch<WeatherReport>(`/api/weather?${params.toString()}`, { signal });
}

export function getCityDescription(title: string, signal?: AbortSignal): Promise<CityDescription> {
  const params = new URLSearchParams({ title });
  return apiFetch<CityDescription>(`/api/city-description?${params.toString()}`, { signal });
}

export function getLocation(signal?: AbortSignal): Promise<DetectedLocation> {
  return apiFetch<DetectedLocation>("/api/location", { signal });
}
