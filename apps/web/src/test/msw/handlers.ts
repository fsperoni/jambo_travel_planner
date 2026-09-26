import { http, HttpResponse } from "msw";

// The app's default API base URL when VITE_API_BASE_URL isn't set — see
// api/http.ts. Tests never set that env var, so requests go here, and
// these handlers match against the same literal URL rather than a
// wildcard, so a typo'd path in application code shows up as an
// (MSW-reported) unhandled request instead of silently matching anyway.
const API_BASE_URL = "http://localhost:3000";

export const VALID_CREDENTIALS = { email: "person@example.com", password: "correct-password" };

export const MOCK_LOGIN_RESPONSE = {
  accessToken: "mock-access-token",
  expiresIn: 900,
  user: { id: "user-1", email: VALID_CREDENTIALS.email },
};

// Default handlers, used unless a test overrides them with server.use(...)
// for a specific scenario (an error response, a delayed response, etc.).
export const handlers = [
  http.post(`${API_BASE_URL}/api/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };

    if (body.email === VALID_CREDENTIALS.email && body.password === VALID_CREDENTIALS.password) {
      return HttpResponse.json(MOCK_LOGIN_RESPONSE, { status: 200 });
    }

    return HttpResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid email or password" } },
      { status: 401 },
    );
  }),
];
