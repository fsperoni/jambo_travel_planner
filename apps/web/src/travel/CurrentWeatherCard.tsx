import { getWeatherIcon } from "../lib/weather-icons";
import type { CurrentWeather, WeatherReport } from "../api/types";
import styles from "./CurrentWeatherCard.module.css";

interface CurrentWeatherCardProps {
  current: CurrentWeather;
  units: WeatherReport["units"];
}

export function CurrentWeatherCard({ current, units }: CurrentWeatherCardProps) {
  const Icon = getWeatherIcon(current.condition.code, current.isDay);

  return (
    <section className={styles.card} aria-label="Current weather">
      <div className={styles.iconRow}>
        <Icon size={48} className={styles.icon} aria-hidden="true" />
        <div>
          <p className={styles.temperature}>
            {Math.round(current.temperature)}
            {units.temperature}
          </p>
          <p className={styles.condition}>{current.condition.label}</p>
        </div>
      </div>
      <dl className={styles.details}>
        <div>
          <dt>Feels like</dt>
          <dd>
            {Math.round(current.feelsLike)}
            {units.temperature}
          </dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{current.humidity}%</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>
            {Math.round(current.windSpeed)} {units.windSpeed}
          </dd>
        </div>
      </dl>
    </section>
  );
}
