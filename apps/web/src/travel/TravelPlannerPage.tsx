import { useEffect, useRef, useState } from "react";
import { toErrorMessage } from "../api/http";
import { getCities, getLocation } from "../api/travel.api";
import type { City, DetectedLocation } from "../api/types";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { CityDescriptionCard } from "./CityDescriptionCard";
import { CitySelect } from "./CitySelect";
import { CurrentWeatherCard } from "./CurrentWeatherCard";
import { ForecastDatePicker } from "./ForecastDatePicker";
import { SelectedDayCard } from "./SelectedDayCard";
import { useCityData } from "./useCityData";
import { useCityDescription } from "./useCityDescription";
import { WeekForecast } from "./WeekForecast";
import styles from "./TravelPlannerPage.module.css";

// A third outcome alongside "still loading" (null) and "detected
// something" (a real DetectedLocation): GET /api/location itself being
// unreachable. Every *provider* failure (ipapi.co down, rate-limited,
// nothing for this IP) is already handled server-side by falling back to
// the default city — this only covers the endpoint call itself failing,
// which the page still needs to recover from by picking some starting
// city, silently, rather than block forever or show an error for a
// feature the user never explicitly asked to see.
type LocationOutcome = DetectedLocation | "unavailable";

export function TravelPlannerPage() {
  const [cities, setCities] = useState<City[] | null>(null);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [citiesRetryCount, setCitiesRetryCount] = useState(0);
  const [locationOutcome, setLocationOutcome] = useState<LocationOutcome | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Guards the one-time initial-selection effect below with a ref, not
  // state — it must never re-run once it's picked a starting city, even
  // though `cities` itself changes again right after (from that same
  // effect prepending a dynamic city).
  const appliedInitialSelectionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setCitiesError(null);

    getCities()
      .then((result) => {
        if (cancelled) return;
        setCities(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCitiesError(toErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [citiesRetryCount]);

  // Fetched independently of the city list (and never retried on its own —
  // see the type comment above) — an IP-detection outage shouldn't block
  // the rest of the page any more than a Wikipedia or Open-Meteo one does.
  useEffect(() => {
    let cancelled = false;

    getLocation()
      .then((result) => {
        if (!cancelled) setLocationOutcome(result);
      })
      .catch(() => {
        if (!cancelled) setLocationOutcome("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Runs exactly once, the moment both the city list and the location
  // result are ready: picks the initial city, inserting a one-off dynamic
  // city at the top of the list first if the detected location isn't
  // already one of the catalogue's ~10 — see the README's IP-geolocation
  // section.
  useEffect(() => {
    if (appliedInitialSelectionRef.current || !cities || locationOutcome === null) return;
    appliedInitialSelectionRef.current = true;

    if (locationOutcome === "unavailable") {
      setSelectedCityId(cities[0]?.id ?? null);
      return;
    }

    const { city, source, reason } = locationOutcome;
    setCities((current) => {
      if (!current || current.some((existing) => existing.id === city.id)) return current;
      return [city, ...current];
    });
    setSelectedCityId(city.id);
    setLocationNotice(
      source === "ip"
        ? "Detected from your IP"
        : reason === "local-development"
          ? `Showing ${city.name} (local development)`
          : `Couldn't detect your location, showing ${city.name}`,
    );
  }, [cities, locationOutcome]);

  // A manual city change makes the location notice stale — it describes
  // how the *initial* selection was made, not this one. The selected date
  // is cleared too, deliberately, rather than carried over even when it
  // would still be valid for the new city: a forecast date is a choice
  // about *this* city's calendar, and starting the new city back at
  // "current + week only" is less surprising than silently keeping a date
  // the user picked while looking at somewhere else. (A stale-but-now-
  // invalid date is still handled separately below, for the case where the
  // date became invalid without a city change — e.g. time passing.)
  function handleCityChange(cityId: string): void {
    setSelectedCityId(cityId);
    setLocationNotice(null);
    setSelectedDate(null);
  }

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
    errorCode: weatherErrorCode,
    retry: retryWeather,
  } = useCityData(selectedCity?.latitude ?? null, selectedCity?.longitude ?? null, selectedDate);

  // A city change already clears the date proactively (handleCityChange,
  // above) — this is the remaining case that doesn't go through that path:
  // a date picked for the *current* city stops being valid just from time
  // passing (its allowed range is relative to that city's own local
  // "today", which moves forward without any city change happening at
  // all). Rather than track a clock client-side to predict that, this lets
  // the request go through and recovers from the one error code that means
  // specifically "this date is no longer in range": silently drop it and
  // let the hook refetch without it.
  useEffect(() => {
    if (weatherErrorCode === "FORECAST_DATE_OUT_OF_RANGE" && selectedDate !== null) {
      setSelectedDate(null);
    }
  }, [weatherErrorCode, selectedDate]);

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

  if (!cities || locationOutcome === null) {
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
      <CitySelect cities={cities} selectedCityId={selectedCityId} onChange={handleCityChange} />

      {locationNotice && <p className={styles.locationNotice}>{locationNotice}</p>}

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
          <ForecastDatePicker
            min={weather.allowedForecastDates.min}
            max={weather.allowedForecastDates.max}
            value={selectedDate}
            onChange={setSelectedDate}
          />
          {weather.selectedDay && (
            <SelectedDayCard day={weather.selectedDay} units={weather.units} />
          )}
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
