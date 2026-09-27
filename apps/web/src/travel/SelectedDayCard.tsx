import { formatFullDate, formatLocalTime } from "../lib/iso-date";
import { getWeatherIcon } from "../lib/weather-icons";
import type { DailyForecast, WeatherReport } from "../api/types";
import styles from "./SelectedDayCard.module.css";

interface SelectedDayCardProps {
  day: DailyForecast;
  units: WeatherReport["units"];
}

export function SelectedDayCard({ day, units }: SelectedDayCardProps) {
  const Icon = getWeatherIcon(day.condition.code);

  return (
    <section className={styles.card} aria-label={`Forecast for ${formatFullDate(day.date)}`}>
      <p className={styles.date}>{formatFullDate(day.date)}</p>
      <div className={styles.iconRow}>
        <Icon size={40} className={styles.icon} aria-hidden="true" />
        <div>
          {/* Stacked, not joined on one line — see WeekForecast.module.css
              for the exact overflow bug this avoids repeating. */}
          <p className={styles.temps}>
            <span className={styles.high}>
              {Math.round(day.temperatureMax)}
              {units.temperature}
            </span>
            <span className={styles.low}>
              {Math.round(day.temperatureMin)}
              {units.temperature}
            </span>
          </p>
          <p className={styles.condition}>{day.condition.label}</p>
        </div>
      </div>
      <dl className={styles.details}>
        <div>
          <dt>Chance of precipitation</dt>
          <dd>{day.precipitationProbabilityMax}%</dd>
        </div>
        <div>
          <dt>Sunrise</dt>
          <dd>{formatLocalTime(day.sunrise)}</dd>
        </div>
        <div>
          <dt>Sunset</dt>
          <dd>{formatLocalTime(day.sunset)}</dd>
        </div>
      </dl>
    </section>
  );
}
