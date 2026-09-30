// scripts/lib/secrets.ts
//
// Loads KEY=VALUE secrets for the sync tooling. Prefers the service-account
// location, falls back to the admin's local file. Does NOT mutate process.env
// and never logs values.

import * as fs from "node:fs";

export const PRIMARY_SECRETS_PATH = "C:/ProgramData/lsbd-sync/secrets.env";
export const FALLBACK_SECRETS_PATH = "C:/Users/Administrator/.lsbd-secrets.env";

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      val.length >= 2 &&
      ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadSecrets(): Record<string, string> {
  const path = fs.existsSync(PRIMARY_SECRETS_PATH)
    ? PRIMARY_SECRETS_PATH
    : FALLBACK_SECRETS_PATH;
  return parseEnv(fs.readFileSync(path, "utf8"));
}
