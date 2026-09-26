import { Router } from "express";
import { createAuthController, loginBodySchema } from "../controllers/auth.controller.js";
import { loginRateLimit } from "../middleware/login-rate-limit.js";
import { validate } from "../middleware/validate.js";
import type { AuthService } from "../services/auth.service.js";

export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);

  // No requireAuth here: login is how a client obtains a token in the
  // first place, so it's one of the few endpoints in this API that
  // deliberately isn't behind Bearer auth.
  router.post("/login", loginRateLimit, validate({ body: loginBodySchema }), controller.login);

  return router;
}
