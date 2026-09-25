import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = createApp({ env });

const server = app.listen(env.PORT, () => {
  console.log(`Jambo API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Stop accepting new connections and let in-flight requests finish before
// exiting, rather than dropping them mid-response. Stage 2 extends this to
// also close the PostgreSQL pool once one exists.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down gracefully`);
  server.close((err) => {
    if (err) {
      console.error("Error while closing server", err);
      process.exit(1);
    }
    process.exit(0);
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
