/**
 * Client IP for rate limiting: first `x-forwarded-for` entry, then `x-real-ip`.
 * Falls back to a single "unknown" bucket when neither header is present.
 */
export function clientIp(h: { get(name: string): string | null }): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}
