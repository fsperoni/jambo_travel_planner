import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { createUserRepository } from "./repositories/user.repository.js";
import { createAuthService } from "./services/auth.service.js";
import { createTokenService } from "./services/token.service.js";

const env = loadEnv();

// Composition root: the one place that wires concrete implementations
// (a real pg Pool, a real TokenService) into the services the app depends
// on. Integration tests perform this same wiring themselves against
// TEST_DATABASE_URL instead of importing anything from this file, which is
// what keeps them able to build the app without starting a real server.
const pool = createPool(env.DATABASE_URL);
const userRepository = createUserRepository(pool);
const tokenService = createTokenService(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS);
const authService = createAuthService({
  userRepository,
  tokenService,
  accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
});

const app = createApp({ env, authService });

const server = app.listen(env.PORT, () => {
  console.log(`Jambo API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Stop accepting new connections and let in-flight requests finish before
// exiting, rather than dropping them mid-response.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down gracefully`);
  server.close((err) => {
    if (err) {
      console.error("Error while closing server", err);
      process.exit(1);
    }
    // Only close the pool after the HTTP server has finished closing, so
    // an in-flight request's query doesn't get its connection yanked out
    // from under it mid-shutdown.
    pool
      .end()
      .then(() => process.exit(0))
      .catch((poolErr: unknown) => {
        console.error("Error while closing the database pool", poolErr);
        process.exit(1);
      });
  });

  // Belt-and-braces: if something is holding a connection open and
  // server.close() never calls back, force-exit rather than hang forever —
  // relevant on a host that sends SIGTERM ahead of a redeploy.
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
