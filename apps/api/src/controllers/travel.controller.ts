import type { Request, Response } from "express";
import { z } from "zod";
import { listCities } from "../domain/city-catalogue.js";
import type { DescriptionService } from "../services/description.service.js";
import type { LocationService } from "../services/location.service.js";
import type { WeatherService } from "../services/weather.service.js";

// Co-located with the controller that reads it, same convention as
// controllers/auth.controller.ts's loginBodySchema.
export const weatherQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export type WeatherQuery = z.infer<typeof weatherQuerySchema>;

export const cityDescriptionQuerySchema = z.object({
  title: z.string().min(1, "title is required").max(200, "title is too long"),
});

export type CityDescriptionQuery = z.infer<typeof cityDescriptionQuerySchema>;

export interface TravelController {
  listCities(req: Request, res: Response): void;
  getWeather(req: Request, res: Response): Promise<void>;
  getCityDescription(req: Request, res: Response): Promise<void>;
  getLocation(req: Request, res: Response): Promise<void>;
}

export interface TravelControllerDependencies {
  weatherService: WeatherService;
  descriptionService: DescriptionService;
  locationService: LocationService;
}

export function createTravelController({
  weatherService,
  descriptionService,
  locationService,
}: TravelControllerDependencies): TravelController {
  return {
    listCities(_req, res) {
      // No dependency needed here — the catalogue is a static, read-only
      // constant (domain/city-catalogue.ts), not something a service or
      // repository fetches.
      res.status(200).json(listCities());
    },

    async getWeather(req, res) {
      const { latitude, longitude } = req.valid!.query as WeatherQuery;
      const report = await weatherService.getWeatherReport(latitude, longitude);
      res.status(200).json(report);
    },

    async getCityDescription(req, res) {
      const { title } = req.valid!.query as CityDescriptionQuery;
      const cityDescription = await descriptionService.getCityDescription(title);
      res.status(200).json(cityDescription);
    },

    async getLocation(req, res) {
      // req.ip reflects the socket's real remote address, or the correct
      // hop of X-Forwarded-For once TRUST_PROXY_HOPS/app.set("trust
      // proxy", ...) is configured — see config/env.ts.
      const detected = await locationService.detectLocation(req.ip);
      res.status(200).json(detected);
    },
  };
}
