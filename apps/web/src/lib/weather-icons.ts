import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  Cloudy,
  Moon,
  Sun,
  CloudSun,
  type LucideIcon,
} from "lucide-react";

// WMO weather-code ranges (see the backend's domain/weather-codes.ts for
// the full label table) grouped into the handful of icons that actually
// distinguish them visually — this is presentational grouping, not a
// second copy of the backend's authoritative code→label mapping.
const RANGE_ICONS: ReadonlyArray<{ codes: readonly number[]; icon: LucideIcon }> = [
  { codes: [3], icon: Cloudy },
  { codes: [45, 48], icon: CloudFog },
  { codes: [51, 53, 55, 56, 57], icon: CloudDrizzle },
  { codes: [61, 63, 65, 66, 67], icon: CloudRain },
  { codes: [80, 81, 82], icon: CloudRainWind },
  { codes: [71, 73, 75, 77, 85, 86], icon: CloudSnow },
  { codes: [95, 96, 99], icon: CloudLightning },
];

/**
 * Maps a WMO weather code to a Lucide icon. `isDay` only matters for the
 * clear/mostly-clear range (0–2), the only codes where a sun/moon
 * distinction is meaningful — the backend's `week` entries describe a
 * whole day each and carry no day/night flag, so callers without one just
 * omit it and get the daytime icon.
 */
export function getWeatherIcon(code: number, isDay = true): LucideIcon {
  if (code === 0) return isDay ? Sun : Moon;
  if (code === 1 || code === 2) return isDay ? CloudSun : CloudMoon;

  const match = RANGE_ICONS.find((entry) => entry.codes.includes(code));
  return match?.icon ?? Cloud;
}
