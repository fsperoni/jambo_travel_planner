import type { AuthService } from "../../src/services/auth.service.js";
import type { DescriptionService } from "../../src/services/description.service.js";
import type { WeatherService } from "../../src/services/weather.service.js";

/**
 * An AuthService stub for tests (like the /health and 404 tests) that need
 * createApp()'s full AppDependencies shape but never actually call auth
 * routes. Calling login() without stubbing it first throws loudly, so a
 * test that unexpectedly hits it fails with a clear message instead of a
 * confusing unrelated error.
 */
export function createFakeAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    login: () => {
      throw new Error("createFakeAuthService: login() was not stubbed for this test");
    },
    ...overrides,
  };
}

/** Same idea as createFakeAuthService, for tests that need createApp()'s
 *  dependencies satisfied but don't exercise /api/weather. */
export function createFakeWeatherService(overrides: Partial<WeatherService> = {}): WeatherService {
  return {
    getWeatherReport: () => {
      throw new Error("createFakeWeatherService: getWeatherReport() was not stubbed for this test");
    },
    ...overrides,
  };
}

/** Same idea as createFakeAuthService, for tests that need createApp()'s
 *  dependencies satisfied but don't exercise /api/city-description. */
export function createFakeDescriptionService(
  overrides: Partial<DescriptionService> = {},
): DescriptionService {
  return {
    getCityDescription: () => {
      throw new Error(
        "createFakeDescriptionService: getCityDescription() was not stubbed for this test",
      );
    },
    ...overrides,
  };
}
