// Staff screens are read-only until go-live. The one switch is LSBD_STAFF_MODE;
// anything other than exactly "live" (after trim/lowercase) stays read-only.
export type StaffMode = "readonly" | "live";

export const READONLY_BANNER_TITLE = "Read-only until go-live";
export const READONLY_BANNER_TEXT =
  "Licensee, permit and firm records here are a copy of the Access database, refreshed about every 15 minutes during business hours. They cannot be changed here until go-live: keep making changes in Access.";

export function parseStaffMode(v: string | null | undefined): StaffMode {
  return typeof v === "string" && v.trim().toLowerCase() === "live" ? "live" : "readonly";
}

export function getStaffMode(
  env: Record<string, string | undefined> = process.env
): StaffMode {
  return parseStaffMode(env.LSBD_STAFF_MODE);
}
