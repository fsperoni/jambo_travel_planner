import { Router } from "express";
import {
  cityDescriptionQuerySchema,
  createTravelController,
  weatherQuerySchema,
} from "../controllers/travel.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import type { DescriptionService } from "../services/description.service.js";
import type { TokenService } from "../services/token.service.js";
import type { WeatherService } from "../services/weather.service.js";

export interface TravelRoutesDependencies {
  tokenService: TokenService;
  weatherService: WeatherService;
  descriptionService: DescriptionService;
}

export function createTravelRoutes({
  tokenService,
  weatherService,
  descriptionService,
}: TravelRoutesDependencies): Router {
  const router = Router();
  const controller = createTravelController({ weatherService, descriptionService });

  // Every route in this router requires a valid Bearer token — unlike
  // /api/auth/login, none of these hand out credentials, so there's no
  // bootstrapping problem to work around.
  router.use(requireAuth(tokenService));

  router.get("/cities", controller.listCities);
  router.get("/weather", validate({ query: weatherQuerySchema }), controller.getWeather);
  router.get(
    "/city-description",
    validate({ query: cityDescriptionQuerySchema }),
    controller.getCityDescription,
  );

  return router;
}
