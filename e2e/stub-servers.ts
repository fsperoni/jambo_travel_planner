import http from "node:http";
import type { Server } from "node:http";
import {
  CALGARY,
  DESCRIPTION_FIXTURES,
  FORECAST_DATES,
  PORTS,
  SELECTED_DATE,
  TOKYO,
  WEATHER_FIXTURES,
} from "./fixtures.js";

// Stand in for the real Open-Meteo and Wikipedia APIs during E2E — see the
// README's testing strategy for why real upstreams are never hit in this
// suite. Deliberately plain `node:http`, not Express: two fixed routes with
// a handful of query-param branches don't need a framework, and it keeps
// this workspace's dependency list to exactly what Playwright itself needs.

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Matches the real Open-Meteo /v1/forecast shape (clients/open-meteo/raw-types.ts) —
 *  a real captured response's shape, not a guess, carried over from the
 *  backend's own mapper tests. */
function buildForecastResponse(cityId: string) {
  const fixture = WEATHER_FIXTURES[cityId as keyof typeof WEATHER_FIXTURES];
  const dayCount = FORECAST_DATES.length;

  return {
    timezone: cityId === CALGARY.id ? "America/Edmonton" : "Asia/Tokyo",
    current: {
      time: `${FORECAST_DATES[0]}T12:00`,
      temperature_2m: fixture.currentTemperature,
      apparent_temperature: fixture.currentTemperature,
      relative_humidity_2m: 50,
      weather_code: fixture.conditionCode,
      wind_speed_10m: 10,
      is_day: 1,
    },
    daily: {
      time: [...FORECAST_DATES],
      // Every day uses the same condition/precipitation except the one
      // day the test actually picks (SELECTED_DATE), which gets its own
      // distinct temperatureMax — the value the spec asserts on to prove
      // the date picker actually drives a different day's real data, not
      // just re-displaying whatever's already on screen.
      weather_code: Array(dayCount).fill(fixture.conditionCode),
      temperature_2m_max: FORECAST_DATES.map((date) =>
        date === SELECTED_DATE ? fixture.selectedDayTemperatureMax : fixture.currentTemperature + 2,
      ),
      temperature_2m_min: Array(dayCount).fill(fixture.currentTemperature - 5),
      precipitation_probability_max: Array(dayCount).fill(10),
      sunrise: FORECAST_DATES.map((date) => `${date}T07:00`),
      sunset: FORECAST_DATES.map((date) => `${date}T19:00`),
    },
  };
}

function createOpenMeteoStub(): Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/v1/forecast") {
      sendJson(res, 404, { error: "not found in Open-Meteo stub" });
      return;
    }

    const latitude = url.searchParams.get("latitude");
    const cityId =
      latitude === String(CALGARY.latitude)
        ? CALGARY.id
        : latitude === String(TOKYO.latitude)
          ? TOKYO.id
          : null;

    if (!cityId) {
      sendJson(res, 400, { error: `Open-Meteo stub has no fixture for latitude=${latitude}` });
      return;
    }

    sendJson(res, 200, buildForecastResponse(cityId));
  });
}

function createWikipediaStub(): Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const match = /^\/api\/rest_v1\/page\/summary\/(.+)$/.exec(url.pathname);
    if (!match) {
      sendJson(res, 404, { error: "not found in Wikipedia stub" });
      return;
    }

    const title = decodeURIComponent(match[1]!);
    const cityId = title === CALGARY.name ? CALGARY.id : title === TOKYO.name ? TOKYO.id : null;

    if (!cityId) {
      sendJson(res, 404, { error: `Wikipedia stub has no fixture for title=${title}` });
      return;
    }

    sendJson(res, 200, {
      type: "standard",
      title,
      extract: DESCRIPTION_FIXTURES[cityId as keyof typeof DESCRIPTION_FIXTURES],
      content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${title}` } },
    });
  });
}

export interface StubServers {
  openMeteoUrl: string;
  wikipediaUrl: string;
  close(): Promise<void>;
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve) => server.listen(port, resolve));
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

export async function startStubServers(): Promise<StubServers> {
  const openMeteoServer = createOpenMeteoStub();
  const wikipediaServer = createWikipediaStub();

  await Promise.all([
    listen(openMeteoServer, PORTS.openMeteoStub),
    listen(wikipediaServer, PORTS.wikipediaStub),
  ]);

  return {
    openMeteoUrl: `http://localhost:${PORTS.openMeteoStub}`,
    wikipediaUrl: `http://localhost:${PORTS.wikipediaStub}`,
    async close() {
      await Promise.all([close(openMeteoServer), close(wikipediaServer)]);
    },
  };
}
