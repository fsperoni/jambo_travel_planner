// Mirrors the backend's response shapes (apps/api/src/services/auth.service.ts
// and friends). Deliberately duplicated here rather than shared via a
// packages/shared workspace — see the README's monorepo-structure section
// for that trade-off; integration/E2E tests are what catch the two copies
// drifting apart.

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface LoginResponse {
  accessToken: string;
  /** Seconds, matching the backend's ACCESS_TOKEN_TTL_SECONDS. */
  expiresIn: number;
  user: AuthenticatedUser;
}
