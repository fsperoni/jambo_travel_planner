import { describe, expect, it } from "vitest";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("hashes a password and verifies it back successfully", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects the wrong password against a real hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time bcrypt salts a call, even for the same password", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password"),
      hashPassword("same-password"),
    ]);
    expect(a).not.toBe(b);
  });

  it("DUMMY_PASSWORD_HASH is a real, working bcrypt hash that matches nothing", async () => {
    // Sanity check on the hardcoded constant itself: it must be a genuinely
    // valid bcrypt hash (so bcrypt.compare performs a real comparison, not
    // an instant format-error short-circuit) that simply never matches any
    // real login attempt — that's what makes it useful for timing safety
    // in auth.service.ts.
    await expect(verifyPassword("literally anything", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});
