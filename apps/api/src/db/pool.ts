import { Pool } from "pg";

/**
 * Creates a PostgreSQL connection pool. Exactly one Pool is created at
 * startup (server.ts) and passed down through createApp's dependency
 * object — repositories receive it rather than importing/constructing
 * their own connection, which is what lets integration tests build a Pool
 * pointed at TEST_DATABASE_URL and inject that instead.
 *
 * No explicit SSL option here, and none is needed: `pg`'s `Pool` reads
 * `sslmode=require` directly out of the connection string itself and
 * configures SSL from that alone — Neon's own connection strings already
 * include it. Local development and CI connect to a plain local
 * PostgreSQL instance with no `sslmode` param, so the same code path
 * naturally skips SSL there too. Confirmed against the real Neon
 * deployment, not assumed: this required no code change at all.
 */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}
