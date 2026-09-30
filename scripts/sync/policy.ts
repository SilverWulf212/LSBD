import { hmacSsn, normalizeSsn } from "../lib/pii";
import type { TablePolicy } from "./types";

/** Source tables that are never synced (spec section 4.1). */
export const EXCLUDED_TABLES: ReadonlySet<string> = new Set(["VSAuth", "VsCapture", "dtproperties"]);

/**
 * Per-table column policy, applied on LSBDserver before upload (spec section 4.1).
 * Table and column names match the source exactly (case-sensitive).
 */
export const COLUMN_POLICY: Readonly<Record<string, Readonly<TablePolicy>>> = {
  tblDenHyg: { SSN: "hmac", password: "drop" },
  Individual: { SSN: "hmac" },
  tblRndDentists: { SSN: "hmac" },
  tblRndHygienists: { SSN: "hmac" },
  Users: { Password: "drop" },
};

export function policyFor(table: string): TablePolicy {
  if (!Object.prototype.hasOwnProperty.call(COLUMN_POLICY, table)) return {};
  return { ...COLUMN_POLICY[table] };
}

/** Returns a new row with the table's column policy applied. The input is never mutated. */
export function applyPolicy(
  table: string,
  row: Record<string, unknown>,
  hmacKey: Buffer,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  const policy = policyFor(table);
  for (const [column, action] of Object.entries(policy)) {
    if (!Object.prototype.hasOwnProperty.call(out, column)) continue;
    if (action === "drop") {
      delete out[column];
    } else {
      const ssn9 = normalizeSsn(out[column]);
      out[column] = ssn9 === null ? null : hmacSsn(hmacKey, ssn9);
    }
  }
  return out;
}
