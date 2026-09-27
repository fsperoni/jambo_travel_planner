// Used to match an IP-geolocation provider's free-text city name against
// the catalogue's curated `name` field, which may not agree on
// diacritics or casing (e.g. the provider might say "Sao Paulo" where the
// catalogue has "São Paulo", or "sibenik" where it has "Šibenik").
export function normalizeCityName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}
