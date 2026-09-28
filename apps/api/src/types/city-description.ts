// Shared by the Wikipedia client (which produces it) and
// description.service.ts (which consumes it) — same reasoning as
// weather-report.ts: avoids a two-way import between a client and the
// service layered on top of it.
export interface CityDescription {
  title: string;
  /** `null` when Wikipedia has no article for this title, or when the
   *  title resolves to a disambiguation page rather than a real article —
   *  both are normal, expected outcomes, not failures (see the README's
   *  trade-offs section). */
  description: string | null;
  sourceUrl: string | null;
}
