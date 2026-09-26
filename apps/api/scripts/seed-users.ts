import { createPool } from "../src/db/pool.js";
import { hashPassword } from "../src/domain/password.js";
import { parseSeedUsers } from "../src/domain/seed-users.js";
import { createUserRepository } from "../src/repositories/user.repository.js";

/**
 * One-off admin script, not something the running server calls. Run it
 * with `npm run db:seed` after exporting DATABASE_URL and SEED_USERS (or
 * relying on a local .env — see the --env-file-if-exists flag on the
 * script itself). Existing users are left untouched, so it's safe to run
 * more than once.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const rawSeedUsers = process.env.SEED_USERS;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed users");
  }
  if (!rawSeedUsers) {
    throw new Error('SEED_USERS is required, format: "email1:password1,email2:password2"');
  }

  const seedUsers = parseSeedUsers(rawSeedUsers);
  const pool = createPool(databaseUrl);
  const userRepository = createUserRepository(pool);

  try {
    for (const { email, password } of seedUsers) {
      const existing = await userRepository.findByEmail(email);
      if (existing) {
        console.log(`Skipping ${email} — already exists`);
        continue;
      }
      const passwordHash = await hashPassword(password);
      await userRepository.create(email, passwordHash);
      console.log(`Created user ${email}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
