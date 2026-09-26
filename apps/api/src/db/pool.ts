import { Pool } from "pg";

/**
 * Creates a PostgreSQL connection pool. Exactly one Pool is created at
 * startup (server.ts) and passed down through createApp's dependency
 * object — repositories receive it rather than importing/constructing
 * their own connection, which is what lets integration tests build a Pool
 * pointed at TEST_DATABASE_URL and inject that instead.
 *
 * No SSL configuration yet: local development and CI both connect to a
 * plain local PostgreSQL instance. Production (Neon) needs SSL — that's
 * added during the deployment stage once the exact connection-string
 * format Neon expects has been checked, rather than guessed at here.
 */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}
