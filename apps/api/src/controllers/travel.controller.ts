import type { Request, Response } from "express";
import { z } from "zod";
import { listCities } from "../domain/city-catalogue.js";
import type { WeatherService } from "../services/weather.service.js";

// Co-located with the controller that reads it, same convention as
// controllers/auth.controller.ts's loginBodySchema.
export const weatherQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export type WeatherQuery = z.infer<typeof weatherQuerySchema>;

export interface TravelController {
  listCities(req: Request, res: Response): void;
  getWeather(req: Request, res: Response): Promise<void>;
}

export interface TravelControllerDependencies {
  weatherService: WeatherService;
}

export function createTravelController({
  weatherService,
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
  };
}
