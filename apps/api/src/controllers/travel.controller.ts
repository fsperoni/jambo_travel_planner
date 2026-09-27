import type { Request, Response } from "express";
import { z } from "zod";
import { listCities } from "../domain/city-catalogue.js";
import type { DescriptionService } from "../services/description.service.js";
import type { LocationService } from "../services/location.service.js";
import type { WeatherService } from "../services/weather.service.js";

// A real calendar date, not just a string shaped like one — a bare regex
// would accept "2026-02-30" (February has no 30th). One combined check
// rather than a separate .regex().refine() pair, so a malformed string
// (e.g. "09-27-2026") produces one clear message instead of two
// overlapping ones. Verified against real edge cases (Feb 30, month 13, a
// non-leap Feb 29) before relying on it, not assumed from the regex
// looking right.
const isoCalendarDateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}, "date must be a valid calendar date in YYYY-MM-DD format");

// Co-located with the controller that reads it, same convention as
// controllers/auth.controller.ts's loginBodySchema.
export const weatherQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  // Whether this specific date is actually in range for the requested
  // city is a business-logic question, not a shape question — that's
  // checked in weather.service.ts (against the city's own
  // allowedForecastDates), not here.
  date: isoCalendarDateSchema.optional(),
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
      const { latitude, longitude, date } = req.valid!.query as WeatherQuery;
      const report = await weatherService.getWeatherReport(latitude, longitude, date);
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
