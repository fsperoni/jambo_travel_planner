import { expect, test } from "@playwright/test";
import {
  CALGARY,
  DESCRIPTION_FIXTURES,
  E2E_EMAIL,
  E2E_PASSWORD,
  SELECTED_DATE,
  TOKYO,
  WEATHER_FIXTURES,
} from "../fixtures.js";

// The one real end-to-end path this project has: login → the default city
// loads with real data → switching cities actually re-fetches and
// re-renders → picking a forecast date actually drives a different day's
// real data. Every request in this run hits the real backend, which hits
// the real Wikipedia/Open-Meteo *client and mapper* code — only the HTTP
// responses those clients receive are faked (via stub-servers.ts), so a
// real bug in the request/response wiring on either side would still fail
// this test, unlike a fully mocked frontend-only test would catch.
test("login, default city loads, switch city, pick a forecast date", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Default city: the E2E backend runs with TRUST_PROXY_HOPS=0 and
  // Playwright connects over loopback, so location detection takes the
  // "local-development" fallback to DEFAULT_CITY_ID (Calgary) — see
  // playwright.config.ts and the README's IP-geolocation section.
  const citySelect = page.getByRole("combobox", { name: "City" });
  await expect(citySelect).toHaveValue(CALGARY.id);
  await expect(page.getByText(`Showing ${CALGARY.name} (local development)`)).toBeVisible();

  await expect(page.getByText(DESCRIPTION_FIXTURES[CALGARY.id])).toBeVisible();
  await expect(page.getByLabel("Current weather")).toContainText(
    `${WEATHER_FIXTURES[CALGARY.id].currentTemperature}°C`,
  );
  await expect(page.getByLabel("Current weather")).toContainText(
    WEATHER_FIXTURES[CALGARY.id].conditionLabel,
  );

  // Switch cities — asserts the *displayed* data actually changes, not
  // just that the dropdown's value did, the same standard the frontend's
  // own unit tests hold city-switching to.
  await citySelect.selectOption(TOKYO.id);

  await expect(page.getByText(DESCRIPTION_FIXTURES[TOKYO.id])).toBeVisible();
  await expect(page.getByLabel("Current weather")).toContainText(
    `${WEATHER_FIXTURES[TOKYO.id].currentTemperature}°C`,
  );
  await expect(page.getByLabel("Current weather")).toContainText(
    WEATHER_FIXTURES[TOKYO.id].conditionLabel,
  );
  await expect(page.getByText(DESCRIPTION_FIXTURES[CALGARY.id])).not.toBeVisible();

  // Pick a forecast date up to 5 days out and confirm the selected-day
  // card shows that specific day's real (fixture) data. This is a
  // client-side lookup into the week already on screen, not a second
  // request (see TravelPlannerPage/useCityData's comments for why) — the
  // assertion still exercises the real backend/mapper end to end, since
  // that data only reached the browser via the initial weather fetch
  // going through the real Open-Meteo client and mapper.
  await page.getByLabel("See forecast for a specific day").fill(SELECTED_DATE);

  const selectedDayCard = page.getByLabel(/^Forecast for /);
  await expect(selectedDayCard).toBeVisible();
  await expect(selectedDayCard).toContainText(
    `${WEATHER_FIXTURES[TOKYO.id].selectedDayTemperatureMax}°C`,
  );
});
