import type { City } from "../api/types";
import styles from "./CitySelect.module.css";

interface CitySelectProps {
  cities: City[];
  selectedCityId: string | null;
  onChange: (cityId: string) => void;
  disabled?: boolean;
}

export function CitySelect({ cities, selectedCityId, onChange, disabled }: CitySelectProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="city-select">City</label>
      <select
        id="city-select"
        className={styles.select}
        value={selectedCityId ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {cities.map((city) => (
          <option key={city.id} value={city.id}>
            {city.region ? `${city.name}, ${city.region}` : city.name}
          </option>
        ))}
      </select>
    </div>
  );
}
