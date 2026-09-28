import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "../../api/http";
import {
  MOCK_CITIES,
  MOCK_CITY_DESCRIPTION,
  MOCK_LOCATION,
  MOCK_LOGIN_RESPONSE,
  MOCK_WEATHER_REPORT,
  VALID_CREDENTIALS,
} from "../fixtures";

// Default handlers, used unless a test overrides them with server.use(...)
// for a specific scenario (an error response, a delayed response, etc.).
// The fixture data these return lives in ../fixtures.ts, shared with tests
// that need the same values to assert against.
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

  http.get(`${API_BASE_URL}/api/cities`, () => HttpResponse.json(MOCK_CITIES, { status: 200 })),

  http.get(`${API_BASE_URL}/api/weather`, () =>
    HttpResponse.json(MOCK_WEATHER_REPORT, { status: 200 }),
  ),

  http.get(`${API_BASE_URL}/api/city-description`, () =>
    HttpResponse.json(MOCK_CITY_DESCRIPTION, { status: 200 }),
  ),

  http.get(`${API_BASE_URL}/api/location`, () => HttpResponse.json(MOCK_LOCATION, { status: 200 })),
];
