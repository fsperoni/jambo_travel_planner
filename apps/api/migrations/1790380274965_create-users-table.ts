import type { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      // Built into PostgreSQL 13+ (no pgcrypto extension needed).
      default: pgm.func("gen_random_uuid()"),
    },
    email: {
      type: "text",
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  // Application code always normalizes email to lowercase before writing or
  // querying, but a CHECK constraint enforces the invariant at the database
  // level too — cheaper to guarantee here than to debug a duplicate-looking
  // account later because one write path forgot to normalize.
  pgm.addConstraint("users", "users_email_lowercase_check", {
    check: "email = lower(email)",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("users");
}
