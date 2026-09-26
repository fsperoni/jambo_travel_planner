import { useEffect, useState } from "react";
import { ApiError } from "../api/http";
import { getCities } from "../api/travel.api";
import type { City } from "../api/types";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { CitySelect } from "./CitySelect";
import { CurrentWeatherCard } from "./CurrentWeatherCard";
import { useCityData } from "./useCityData";
import { WeekForecast } from "./WeekForecast";
import styles from "./TravelPlannerPage.module.css";

export function TravelPlannerPage() {
  const [cities, setCities] = useState<City[] | null>(null);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [citiesRetryCount, setCitiesRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCitiesError(null);

    getCities()
      .then((result) => {
        if (cancelled) return;
        setCities(result);
        // Defaults to the first city in the catalogue until Stage 6 wires
        // up real IP-based detection as the actual default.
        setSelectedCityId((current) => current ?? result[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCitiesError(
          err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [citiesRetryCount]);

  const selectedCity = cities?.find((city) => city.id === selectedCityId) ?? null;
  const {
    weather,
    isLoading: isWeatherLoading,
    error: weatherError,
    retry: retryWeather,
  } = useCityData(selectedCity?.latitude ?? null, selectedCity?.longitude ?? null);

  if (citiesError) {
    return (
      <div className={styles.page}>
        <ErrorState
          message={citiesError}
          onRetry={() => setCitiesRetryCount((count) => count + 1)}
        />
      </div>
    );
  }

  if (!cities) {
    return (
      <div className={styles.page} role="status">
        <span className="srOnly">Loading cities…</span>
        <Skeleton height="2.75rem" width="20rem" />
        <Skeleton height="10rem" />
        <Skeleton height="8rem" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <CitySelect cities={cities} selectedCityId={selectedCityId} onChange={setSelectedCityId} />

      {weatherError && <ErrorState message={weatherError} onRetry={retryWeather} />}

      {!weatherError && isWeatherLoading && (
        <div className={styles.cards} role="status">
          <span className="srOnly">
            Loading weather for {selectedCity?.name ?? "the selected city"}…
          </span>
          <Skeleton height="10rem" />
          <Skeleton height="8rem" />
        </div>
      )}

      {!weatherError && !isWeatherLoading && weather && (
        <div className={styles.cards}>
          <CurrentWeatherCard current={weather.current} units={weather.units} />
          <WeekForecast days={weather.week} units={weather.units} />
        </div>
      )}
    </div>
  );
}
