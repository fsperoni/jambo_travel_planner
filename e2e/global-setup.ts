import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { Pool } from "pg";
import { E2E_EMAIL, E2E_PASSWORD } from "./fixtures.js";
import { startStubServers } from "./stub-servers.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Runs once before any test/webServer starts. Reuses `TEST_DATABASE_URL` —
 * the same database the backend's integration tests run against — rather
 * than provisioning a separate E2E-only database: CI (and a local run) runs
 * `npm test` and `npm run e2e` as separate, sequential steps, never
 * concurrently, so there's no real contention to design around, and adding
 * a second database would be infrastructure with nothing to show for it.
 *
 * Migrations are applied via the backend's own script rather than
 * duplicating the schema here, so there's exactly one definition of it.
 * The `users` table is truncated before seeding (not just "seed if
 * missing") so a stale row from a previous run — possibly with a different
 * password hash — can never make the login step flaky.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL must be set to run the E2E suite — see the README's local setup section.",
    );
  }

  execSync("npm run db:migrate:test -w @jambo/api", {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });

  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query("TRUNCATE users RESTART IDENTITY CASCADE");
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
  await pool.query("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [
    E2E_EMAIL,
    passwordHash,
  ]);
  await pool.end();

  const stubServers = await startStubServers();

  return async function globalTeardown() {
    await stubServers.close();
  };
}
