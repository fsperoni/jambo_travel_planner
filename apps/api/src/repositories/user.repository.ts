import type { Pool } from "pg";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(email: string, passwordHash: string): Promise<User>;
}

// Aliased to the User type's own camelCase field names directly in SQL, so
// a query's result rows already match `User` with no separate mapping step
// — Postgres requires double quotes around an alias to preserve its case;
// without them it folds to lowercase and silently returns e.g.
// `passwordhash` instead. Shared between both queries below so they can't
// drift out of sync with each other.
const USER_COLUMNS = `
  id,
  email,
  password_hash AS "passwordHash",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

/**
 * Takes a `Pool` rather than opening its own connection, so integration
 * tests can build a repository against a Pool pointed at
 * TEST_DATABASE_URL and the seed script (scripts/seed-users.ts) can reuse
 * the exact same `create()` logic the app itself would use.
 */
export function createUserRepository(pool: Pool): UserRepository {
  return {
    async findByEmail(email) {
      const result = await pool.query<User>(
        `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
        // The users_email_lowercase_check constraint means every stored
        // email is already lowercase — normalizing the lookup value here
        // is what makes that constraint actually useful for querying, not
        // just for storage.
        [email.toLowerCase()],
      );
      return result.rows[0] ?? null;
    },

    async create(email, passwordHash) {
      const result = await pool.query<User>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING ${USER_COLUMNS}`,
        [email.toLowerCase(), passwordHash],
      );
      const user = result.rows[0];
      if (!user) {
        // Only reachable if INSERT...RETURNING somehow returns zero rows,
        // which PostgreSQL doesn't do on a successful insert — this is
        // defensive, not a case the tests need to exercise.
        throw new Error("Insert into users did not return a row");
      }
      return user;
    },
  };
}
