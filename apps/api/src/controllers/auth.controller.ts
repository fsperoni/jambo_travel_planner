import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthService } from "../services/auth.service.js";

// Co-located with the controller that reads it (via req.valid.body) rather
// than in a separate schemas/ directory — this is the only place that
// needs to know the login request's shape.
export const loginBodySchema = z.object({
  email: z.email(),
  // bcrypt only looks at a password's first 72 *bytes*; capping length here
  // is a UTF-16-code-unit approximation of that byte limit — good enough to
  // reject obviously-too-long input at the door. The precise byte-accurate
  // check lives where it actually matters, password creation, in
  // scripts/seed-users.ts.
  password: z.string().min(1, "Password is required").max(72, "Password is too long"),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export interface AuthController {
  login(req: Request, res: Response): Promise<void>;
}

export function createAuthController(authService: AuthService): AuthController {
  return {
    async login(req, res) {
      // Cast is safe: this handler is only ever reached after
      // validate({ body: loginBodySchema }) has already run and thrown on
      // anything not matching LoginBody.
      const { email, password } = req.valid!.body as LoginBody;
      const result = await authService.login(email, password);
      res.status(200).json(result);
    },
  };
}
