// Data-oddity rules for licence rows (rulings Q2, Q3). Pure; loaders supply
// duplicateCount (rows in lsbd.license with the same type + license_id,
// including this one).
import { isExpired } from "./public-verify-helpers";

export type LicenceOddity = "expired-active" | "no-status" | "duplicate-number";

export const ODDITY_LABELS: Record<LicenceOddity, string> = {
  "expired-active": "Active, past expiry",
  "no-status": "No status (unmapped source code, e.g. CUR)",
  "duplicate-number": "Duplicate type + number",
};

export function licenceOddities(
  l: { status: string | null; dateUntil: string | null; type: string | null; duplicateCount: number },
  now: Date
): LicenceOddity[] {
  const out: LicenceOddity[] = [];
  if ((l.status === "ACT" || l.status === "PRB") && isExpired(l.dateUntil, now)) {
    out.push("expired-active");
  }
  if (l.status === null) out.push("no-status");
  if (l.type !== null && l.duplicateCount > 1) out.push("duplicate-number");
  return out;
}
