import type { AuthService } from "../../src/services/auth.service.js";

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
