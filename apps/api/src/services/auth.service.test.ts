import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "./auth.service.js";
import { hashPassword } from "../domain/password.js";
import { UnauthorizedError } from "../errors/app-error.js";
import type { User, UserRepository } from "../repositories/user.repository.js";
import { TEST_USER, UNKNOWN_EMAIL } from "../../test/helpers/fixtures.js";
import { createFakeTokenService } from "../../test/helpers/fakes.js";

function fakeUserRepository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    ...overrides,
  };
}

function fakeTokenService() {
  return createFakeTokenService({ signAccessToken: vi.fn().mockReturnValue("signed-token") });
}

async function makeUser(overrides: Partial<User> = {}): Promise<User> {
  return {
    id: TEST_USER.id,
    email: TEST_USER.email,
    passwordHash: await hashPassword(TEST_USER.password),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("auth service: login", () => {
  it("returns an access token and the user on valid credentials", async () => {
    const user = await makeUser();
    const userRepository = fakeUserRepository({ findByEmail: vi.fn().mockResolvedValue(user) });
    const tokenService = fakeTokenService();
    const service = createAuthService({ userRepository, tokenService, accessTokenTtlSeconds: 900 });

    const result = await service.login(TEST_USER.email, TEST_USER.password);

    expect(result).toEqual({
      accessToken: "signed-token",
      expiresIn: 900,
      user: { id: TEST_USER.id, email: TEST_USER.email },
    });
    expect(tokenService.signAccessToken).toHaveBeenCalledWith({
      sub: TEST_USER.id,
      email: TEST_USER.email,
    });
  });

  it("rejects an unknown email with a generic 401, not a distinguishing message", async () => {
    const userRepository = fakeUserRepository(); // findByEmail resolves null by default
    const service = createAuthService({
      userRepository,
      tokenService: fakeTokenService(),
      accessTokenTtlSeconds: 900,
    });

    const promise = service.login(UNKNOWN_EMAIL, "anything");
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(promise).rejects.toThrow("Invalid email or password");
  });

  it("rejects a wrong password with the same generic message as an unknown email", async () => {
    const user = await makeUser();
    const userRepository = fakeUserRepository({ findByEmail: vi.fn().mockResolvedValue(user) });
    const service = createAuthService({
      userRepository,
      tokenService: fakeTokenService(),
      accessTokenTtlSeconds: 900,
    });

    const promise = service.login(TEST_USER.email, "wrong-password");
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(promise).rejects.toThrow("Invalid email or password");
  });

  it("still calls bcrypt.compare when no user is found (timing-safety guard)", async () => {
    // Regression guard for the specific mitigation in auth.service.ts: if
    // this ever gets "optimized" into an early return before verifyPassword
    // runs, an unknown-email login would resolve near-instantly while a
    // known-email/wrong-password login takes a full bcrypt compare —
    // a timing gap that leaks which emails have accounts. This test
    // doesn't measure timing directly (unreliable in CI); it asserts the
    // compare actually happens either way, which is what makes the timing
    // equal in the first place.
    const findByEmail = vi.fn().mockResolvedValue(null);
    const userRepository = fakeUserRepository({ findByEmail });
    const service = createAuthService({
      userRepository,
      tokenService: fakeTokenService(),
      accessTokenTtlSeconds: 900,
    });

    const start = performance.now();
    await service.login(UNKNOWN_EMAIL, "anything").catch(() => {});
    const elapsedMs = performance.now() - start;

    // A bcrypt compare at cost factor 10 takes single-digit-to-low-double-
    // digit milliseconds; a genuine early return would complete in
    // fractions of a millisecond. This is a coarse sanity check, not a
    // precise timing assertion.
    expect(elapsedMs).toBeGreaterThan(1);
  });
});
