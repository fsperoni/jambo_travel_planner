import { formatWeekday } from "../lib/iso-date";
import { getWeatherIcon } from "../lib/weather-icons";
import type { DailyForecast, WeatherReport } from "../api/types";
import styles from "./WeekForecast.module.css";

interface WeekForecastProps {
  days: DailyForecast[];
  units: WeatherReport["units"];
}

export function WeekForecast({ days, units }: WeekForecastProps) {
  return (
    <section className={styles.week} aria-label="7-day forecast">
      <h2 className={styles.title}>This week</h2>
      <ul className={styles.list}>
        {days.map((day, index) => {
          const Icon = getWeatherIcon(day.condition.code);
          // `days[0]` is always the city-local "today" — see the backend's
          // weather.service.ts — so there's no separate "today" flag to
          // thread through, just the day's position in the list.
          const label = index === 0 ? "Today" : formatWeekday(day.date);

          return (
            <li key={day.date} className={styles.day}>
              <p className={styles.dayLabel}>{label}</p>
              {/* `title` gives mouse users a native hover tooltip naming the
                  condition (e.g. "Slight rain showers") — the icon alone is
                  genuinely ambiguous at this size, which is the exact gap
                  Fabio flagged. The icon itself stays decorative
                  (aria-hidden) and the *text* sibling carries the same
                  label for screen readers instead: this app's week strip
                  had no accessible description of the day's condition at
                  all before this, unlike CurrentWeatherCard, which already
                  shows the condition as visible text. */}
              <span className={styles.iconWrap} title={day.condition.label}>
                <Icon size={28} className={styles.icon} aria-hidden="true" />
                <span className="srOnly">{day.condition.label}</span>
              </span>
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
