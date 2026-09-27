const IPV4_MAPPED_PREFIX = "::ffff:";

/**
 * A dual-stack Node server sees an IPv4 client's address wrapped as
 * "::ffff:203.0.113.5" rather than the plain "203.0.113.5" — strip that
 * prefix so downstream code (isLoopback, ipapi.co) only ever sees one form
 * per address, not two that mean the same thing.
 */
export function normalizeIp(ip: string): string {
  return ip.startsWith(IPV4_MAPPED_PREFIX) ? ip.slice(IPV4_MAPPED_PREFIX.length) : ip;
}

/**
 * True for the two forms a request from the same machine as the server
 * actually arrives as (IPv4 and IPv6 loopback) — i.e. local development,
 * where there's no real client IP to geolocate at all. Call after
 * normalizeIp(), not before, so "::ffff:127.0.0.1" is also recognized.
 */
export function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1";
}
