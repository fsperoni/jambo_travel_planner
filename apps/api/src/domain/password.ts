import bcrypt from "bcrypt";

// bcrypt's own long-standing default. Higher costs resist brute-forcing
// better but slow down every login and every test that hashes a password;
// 10 is a reasonable balance for this project's scale.
const SALT_ROUNDS = 10;

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * A precomputed hash of an arbitrary string that is not, and has never
 * been, anyone's real password. `bcrypt.compare()` against this constant
 * costs the same as comparing against a genuine user's hash, so a login
 * attempt for an email with no matching account takes roughly as long as
 * one for an email that exists but has the wrong password — see its use in
 * auth.service.ts. Without it, skipping straight to "no such user" would
 * return near-instantly, letting a timing measurement distinguish "wrong
 * password" from "no such account" and confirm which emails have accounts.
 */
export const DUMMY_PASSWORD_HASH = "$2b$10$AwPQH.E1Mg5U7TvjrA8d8umKnZYy4wRe7di4PZ0cgNRhxAmnpXUwy";
