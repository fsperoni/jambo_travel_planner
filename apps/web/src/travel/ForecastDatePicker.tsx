import styles from "./ForecastDatePicker.module.css";

interface ForecastDatePickerProps {
  min: string;
  max: string;
  /** `null` means no specific day is selected — the current+week cards
   *  are showing, not a `SelectedDayCard`. */
  value: string | null;
  onChange: (date: string | null) => void;
}

/**
 * A native `<input type="date">` with `min`/`max` bound to the city's own
 * `allowedForecastDates` — most browsers grey out or refuse dates outside
 * that range directly in their date-picker UI, which is a real,
 * zero-JavaScript layer of "only current date through +5 days is
 * selectable" on top of the backend's own validation (never trusted
 * alone, since a client can always send an out-of-range date directly to
 * the API regardless of what this input allows).
 */
export function ForecastDatePicker({ min, max, value, onChange }: ForecastDatePickerProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="forecast-date">See forecast for a specific day</label>
      <input
        id="forecast-date"
        type="date"
        className={styles.input}
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </div>
  );
}
