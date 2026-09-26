import { DUMMY_PASSWORD_HASH, verifyPassword } from "../domain/password.js";
import { UnauthorizedError } from "../errors/app-error.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { TokenService } from "./token.service.js";

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  user: { id: string; email: string };
}

export interface AuthService {
  login(email: string, password: string): Promise<LoginResult>;
}

export interface AuthServiceDependencies {
  userRepository: UserRepository;
  tokenService: TokenService;
  accessTokenTtlSeconds: number;
}

export function createAuthService({
  userRepository,
  tokenService,
  accessTokenTtlSeconds,
}: AuthServiceDependencies): AuthService {
  return {
    async login(email, password) {
      const user = await userRepository.findByEmail(email);

      // Always run a bcrypt.compare, even when no user was found, against
      // DUMMY_PASSWORD_HASH instead of skipping straight to "invalid" —
      // see that constant's comment for why this matters for timing.
      const passwordIsValid = await verifyPassword(
        password,
        user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      );

      if (!user || !passwordIsValid) {
        // Same message either way: "no such account" vs "wrong password"
        // would let a client enumerate which emails have accounts.
        throw new UnauthorizedError("Invalid email or password");
      }

      const accessToken = tokenService.signAccessToken({ sub: user.id, email: user.email });

      return {
        accessToken,
        expiresIn: accessTokenTtlSeconds,
        user: { id: user.id, email: user.email },
      };
    },
  };
}
