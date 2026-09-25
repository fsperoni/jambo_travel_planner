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
