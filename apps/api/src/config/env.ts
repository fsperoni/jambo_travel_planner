import { z } from "zod";

// Fail fast: if required configuration is missing or malformed, the process
// should refuse to start rather than fail confusingly on whichever request
// happens to need the missing value first. Built up incrementally — each
// stage adds only the variables it actually consumes (e.g. JWT_SECRET
// arrives with Stage 2's auth, DATABASE_URL with Stage 2's persistence)
// rather than pre-declaring config for features that don't exist yet.
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
  return result.data;
}
