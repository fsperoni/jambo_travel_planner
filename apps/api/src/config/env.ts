import { z } from "zod";
import { findCityById } from "../domain/city-catalogue.js";

// Fail fast: if required configuration is missing or malformed, the process
// should refuse to start rather than fail confusingly on whichever request
// happens to need the missing value first. Each variable here is one the
// app actually reads somewhere (see the README's environment-variables
// table for what each one does), not speculative config for a feature that
// doesn't exist.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // Comma-separated list of origins allowed to call this API from a
  // browser — in practice, just the frontend's own URL(s).
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z.url("DATABASE_URL must be a valid connection string, e.g. postgres://..."),

  // HS256 signing secret for access tokens. 32 bytes/chars is the minimum
  // for HS256 to provide its intended security margin (a shorter secret is
  // brute-forceable); this doesn't validate that it's *random*, only that
  // it's long enough to plausibly be.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // How long an access token stays valid. Stored as plain seconds (not a
  // duration string like "15m") so both jsonwebtoken's `sign()` and the
  // API's own `expiresIn` response field can use the same number directly,
  // with no duration-parsing library needed.
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  // Overridable so integration tests can point the weather client at a
  // local stub server instead of the real API — see clients/open-meteo/.
  OPEN_METEO_BASE_URL: z.url().default("https://api.open-meteo.com"),

  // Overridable for the same reason as OPEN_METEO_BASE_URL — see clients/wikipedia/.
  WIKIPEDIA_BASE_URL: z.url().default("https://en.wikipedia.org"),

  // Wikimedia's API rejects requests with no User-Agent outright (confirmed
  // directly against the real API: a blank one gets a 403) and its stated
  // policy wants a client name/version plus contact info (an email, a
  // website, or a wiki username) identifying who's calling it — see
  // https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy.
  // The default below is a local-dev-only placeholder with no personal
  // information in it; set this to a real contact URL for production.
  WIKIPEDIA_USER_AGENT: z
    .string()
    .min(1)
    .default(
      "JamboTravelPlanner/0.1 (local-development; set WIKIPEDIA_USER_AGENT for production) node",
    ),

  // Overridable for the same reason as the other two base URLs — see
  // clients/ip-geolocation/.
  IP_GEOLOCATION_BASE_URL: z.url().default("https://ipwho.is"),

  // The city shown (and the source of its weather/description) when IP
  // geolocation can't run at all (local dev) or doesn't produce a usable
  // result (provider outage, rate limit, an IP it won't geolocate). Must
  // be a real id in domain/city-catalogue.ts — checked below, not just by
  // this schema, since Zod alone can't see the catalogue.
  DEFAULT_CITY_ID: z.string().min(1).default("calgary"),

  // Express's `trust proxy` setting, as a hop count rather than `true`
  // (which would trust *any* X-Forwarded-For value, letting a client spoof
  // its own IP just by sending the header). `0` (the default, correct for
  // local dev with no reverse proxy in front) means req.ip always reflects
  // the actual TCP connection. In production this must be `3`, not `1` —
  // an earlier version of this comment assumed Render sits exactly one
  // reverse proxy in front of this app; that was wrong, caught only by
  // deploying a temporary debug endpoint that echoed the raw
  // X-Forwarded-For header and the resolved req.ip from a real request
  // (see this date's AI_USAGE.md entry). The real chain has three
  // entries — the visitor's own IP, then Cloudflare's edge, then Render's
  // own internal load balancer — so `1` was resolving req.ip to Render's
  // own internal (private) address, which the geolocation provider
  // correctly rejected, landing on the *same* fallback reason
  // ("lookup-failed") a genuine provider outage would. `3` (not just "2
  // trusted proxies") because Express's numeric `trust proxy` counts hops
  // from the right including the one whose value it returns — see
  // test/travel.test.ts's spoofed-header test for the same counting
  // pinned down as a regression, now against the real 3-hop chain rather
  // than an assumed 1-hop one.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Flattened to one readable line per field rather than the raw
    // ZodError — this is what greets whoever runs the app with a missing
    // or malformed .env, so it should be immediately actionable.
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  // Zod can validate DEFAULT_CITY_ID is a non-empty string, but not that
  // it's an id that actually exists — that needs the catalogue itself,
  // checked here so a typo'd id fails at startup, not the first time
  // location detection needs to fall back to it.
  if (!findCityById(result.data.DEFAULT_CITY_ID)) {
    throw new Error(
      `Invalid environment configuration:\n  - DEFAULT_CITY_ID: "${result.data.DEFAULT_CITY_ID}" is not a city id in domain/city-catalogue.ts`,
    );
  }

  return result.data;
}
