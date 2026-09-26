export interface SeedUser {
  email: string;
  password: string;
}

/**
 * Parses the SEED_USERS env var into a list of accounts to create.
 * Format: "email1:password1,email2:password2" — deliberately simple text
 * rather than JSON, so it can be pasted directly into a hosting provider's
 * env var UI without escaping quotes. The trade-off: neither an email nor
 * a password may contain a literal ":" or ",".
 */
export function parseSeedUsers(raw: string): SeedUser[] {
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [email, password] = pair.split(":");
      if (!email || !password) {
        throw new Error(
          `Malformed SEED_USERS entry "${pair}" — expected "email:password", and neither may ` +
            'contain ":" or ","',
        );
      }

      // bcrypt only reads a password's first 72 *bytes*; anything longer
      // is silently truncated at hash time, which would leave someone
      // unable to explain why the password they typed "works" (it's
      // actually the truncated prefix that matches). Reject it outright
      // instead of hashing a value that doesn't mean what it looks like.
      if (Buffer.byteLength(password, "utf8") > 72) {
        throw new Error(`Password for "${email}" exceeds bcrypt's 72-byte limit`);
      }

      return { email, password };
    });
}
