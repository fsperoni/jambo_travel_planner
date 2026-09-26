import { Pool } from "pg";

/**
 * Integration tests that need real PostgreSQL behaviour (unique
 * constraints, the lowercase-email CHECK, actual query round-trips) run
 * against TEST_DATABASE_URL rather than mocking `pg` — a mock can't catch
 * a migration/query mismatch the way a real database does. Run
 * `npm run db:migrate:test` against it before running these tests.
 */
export function createTestPool(): Pool {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Point it at a local PostgreSQL database with the " +
        "migrations applied (`npm run db:migrate:test`) before running integration tests.",
    );
  }
  return new Pool({ connectionString });
}

/** Clears test data between tests without dropping/recreating the schema. */
export async function truncateAllTables(pool: Pool): Promise<void> {
  await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
}
