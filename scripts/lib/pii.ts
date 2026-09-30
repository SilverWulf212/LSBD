import * as crypto from "node:crypto";

/** Normalise an SSN-ish value to exactly 9 digits, or null if it isn't one. */
export function normalizeSsn(v: unknown): string | null {
  if (v == null) return null;
  const digits = String(v).replace(/\D/g, "");
  if (digits.length !== 9) return null;
  return digits;
}

/** base64 HMAC-SHA256 of a normalised 9-digit SSN. Must stay byte-identical to etl-b2-pii.ts output. */
export function hmacSsn(key: Buffer, ssn9: string): string {
  return crypto.createHmac("sha256", key).update(ssn9).digest("base64");
}
