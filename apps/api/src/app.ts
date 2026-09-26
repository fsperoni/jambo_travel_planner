import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { createAuthRoutes } from "./routes/auth.routes.js";
import type { Env } from "./config/env.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import type { AuthService } from "./services/auth.service.js";

export interface AppDependencies {
  env: Pick<Env, "CORS_ORIGINS">;
  authService: AuthService;
}

/**
 * Builds the Express app without starting an HTTP listener. Kept separate
 * from server.ts (which calls `.listen()`) so integration tests can import
 * `createApp` and drive it directly with Supertest, without binding a real
 * port or needing a running process.
 */
export function createApp({ env, authService }: AppDependencies): Express {
  const app = express();

  // A conservative set of security-related response headers (X-Content-
  // -Type-Options, X-Frame-Options, a default Content-Security-Policy,
  // etc.). The API serves JSON only, never HTML, so the default policy is
  // enough for now — CSP tuning is a frontend concern and is listed as a
  // "with more time" improvement in the README.
  app.use(helmet());

  app.use(
    cors({
      // Only the frontend's own origin(s) may call this API from a browser.
      // `credentials: true` isn't needed here: the access token is attached
      // as an `Authorization` header by the frontend's own code, not sent
      // automatically by the browser the way a cookie would be. If a
      // refresh-token cookie is added later as an auth enhancement,
      // `credentials: true` gets added then, alongside the cookie itself —
      // not before there's a cookie that needs it.
      origin: env.CORS_ORIGINS,
    }),
  );

  // Every request body in this API is small JSON (credentials, a date, a
  // couple of coordinates) — 10kb is generous headroom, not a real limit.
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // POST /api/auth/login is deliberately not behind requireAuth — see
  // routes/auth.routes.ts. Feature routes (cities, weather, description,
  // location) that do require it are mounted here starting Stage 4.
  app.use("/api/auth", createAuthRoutes(authService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
