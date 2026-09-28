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

// z.coerce.number() alone has two real problems, both confirmed rather
// than assumed: `Number("")` and `Number("  ")` are `0`, not NaN, so a
// blank `?latitude=` query param silently became a real coordinate (the
// Gulf of Guinea) instead of a validation error; and `Number("0x10")`/
// `Number("1e1")` are `16`/`10`, letting hex and exponential notation
// through as if they were plain decimal input. The `.trim().regex(...)`
// step rejects anything that isn't a plain, ordinary decimal number
// *before* coercion — including the empty string left after trimming
// whitespace-only input, and a repeated query param (`?latitude=1&latitude=2`),
// which Express parses as an array and `z.string()` rejects outright —
// while `.pipe(...)` still lets legitimate `"0"` and `" 0 "` through.
function coordinateSchema(min: number, max: number) {
  return (
    z
      .string()
      .trim()
      .regex(/^-?\d+(\.\d+)?$/, "must be a plain decimal number")
      // .transform(Number).pipe(z.number()...), not z.coerce.number(): the
      // regex above already guarantees a plain decimal string, so a direct
      // Number() conversion is safe, and it sidesteps a real Zod v4 typing
      // quirk (confirmed by trying it) where z.coerce.number()'s declared
      // "unknown" input type doesn't satisfy what .pipe() expects from the
      // previous string schema's output.
      .transform(Number)
      .pipe(z.number().min(min).max(max))
  );
}

// Co-located with the controller that reads it, same convention as
// controllers/auth.controller.ts's loginBodySchema.
export const weatherQuerySchema = z.object({
  latitude: coordinateSchema(-90, 90),
  longitude: coordinateSchema(-180, 180),
  // Whether this specific date is actually in range for the requested
  // city is a business-logic question, not a shape question — that's
  // checked in weather.service.ts (against the city's own
  // allowedForecastDates), not here.
  date: isoCalendarDateSchema.optional(),
});

export type WeatherQuery = z.infer<typeof weatherQuerySchema>;

export const cityDescriptionQuerySchema = z.object({
  // .trim() before .min(1): a whitespace-only title (e.g. "?title=%20")
  // would otherwise pass the length check and get forwarded to the
  // Wikipedia client as a real (nonsensical) lookup.
  title: z.string().trim().min(1, "title is required").max(200, "title is too long"),
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
