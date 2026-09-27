import { useEffect, useState } from "react";
import { ApiError } from "../api/http";
import { getCities } from "../api/travel.api";
import type { City } from "../api/types";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { CityDescriptionCard } from "./CityDescriptionCard";
import { CitySelect } from "./CitySelect";
import { CurrentWeatherCard } from "./CurrentWeatherCard";
import { useCityData } from "./useCityData";
import { useCityDescription } from "./useCityDescription";
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

  // Fetched independently — a Wikipedia outage shouldn't block the weather
  // cards from showing, and vice versa. See the README's split-endpoints
  // trade-off.
  const {
    cityDescription,
    isLoading: isDescriptionLoading,
    error: descriptionError,
    retry: retryDescription,
  } = useCityDescription(selectedCity?.wikipediaTitle ?? null);
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
        <Skeleton height="6rem" />
        <Skeleton height="10rem" />
        <Skeleton height="8rem" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <CitySelect cities={cities} selectedCityId={selectedCityId} onChange={setSelectedCityId} />

      {descriptionError && <ErrorState message={descriptionError} onRetry={retryDescription} />}

      {!descriptionError && isDescriptionLoading && (
        <div role="status">
          <span className="srOnly">
            Loading description for {selectedCity?.name ?? "the selected city"}…
          </span>
          <Skeleton height="6rem" />
        </div>
      )}

      {!descriptionError && !isDescriptionLoading && cityDescription && (
        <CityDescriptionCard cityDescription={cityDescription} />
      )}

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
          <p className={styles.weatherAttribution}>
            Weather data by{" "}
            <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">
              Open-Meteo.com
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
