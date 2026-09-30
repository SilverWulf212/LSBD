// Pure date helpers pinned to the Board's local time zone.
//
// Every legacy MSSQL datetime is naive America/Chicago wall time; the sync
// stores it in `lsbd.*` as timestamptz via `AT TIME ZONE 'America/Chicago'`.
// A source DateUntil of 2027-12-31 00:00 therefore arrives as
// 2027-12-31T06:00:00Z. Formatting that with the server's zone (UTC on
// Vercel) or the browser's zone can shift it to Dec 30, so every UI date
// MUST go through these helpers, which always pass `timeZone`.
//
// No imports on purpose: this module is unit-tested directly by vitest.

export const BOARD_TIME_ZONE = "America/Chicago";

function toDate(v: string | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Dec 31, 2027" (style "short") or "December 31, 2027" (style "long"), in Central time. */
export function formatCentralDate(
  v: string | Date | null | undefined,
  style: "short" | "long" = "short"
): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: BOARD_TIME_ZONE,
    year: "numeric",
    month: style,
    day: "numeric",
  });
}

/** "Sep 30, 2026, 3:44 PM CDT" in Central time. */
export function formatCentralDateTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    timeZone: BOARD_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Central calendar day as "YYYY-MM-DD" (sortable string), or null. */
export function centralDayKey(v: string | Date | null | undefined): string | null {
  const d = toDate(v);
  if (!d) return null;
  // en-CA formats as YYYY-MM-DD.
  return d.toLocaleDateString("en-CA", {
    timeZone: BOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Central wall-clock weekday (0=Sun..6=Sat) and hour (0..23) for an instant. */
export function centralClock(d: Date): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOARD_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hr = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return { weekday, hour: hr % 24 };
}
