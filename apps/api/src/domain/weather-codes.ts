export interface WeatherCondition {
  code: number;
  label: string;
}

// WMO weather interpretation codes (WW), the fixed vocabulary Open-Meteo's
// `weather_code` field uses: https://open-meteo.com/en/docs (see the
// "WMO Weather interpretation codes" table). Kept here, not in
// clients/open-meteo/, since this is a general meteorological standard —
// nothing Open-Meteo-specific about the codes themselves, only about how we
// happen to receive them.
const WEATHER_CODE_LABELS: Readonly<Record<number, string>> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

/** Falls back to "Unknown" for a code outside the table above, rather than
 *  throwing — a weather report the frontend can still mostly render (with
 *  one odd label) is more useful than a hard failure over a vendor adding
 *  a new code we haven't catalogued yet. */
export function describeWeatherCode(code: number): WeatherCondition {
  return { code, label: WEATHER_CODE_LABELS[code] ?? "Unknown" };
}
