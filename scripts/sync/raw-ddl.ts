import { pgTypeFor } from "./type-map";
import type { SourceTable, TablePolicy } from "./types";

const q = (id: string): string => `"${id.replace(/"/g, '""')}"`;

function lockdown(qualified: string): string {
  return [
    `REVOKE ALL ON ${qualified} FROM anon, authenticated;`,
    `ALTER TABLE ${qualified} ENABLE ROW LEVEL SECURITY;`,
  ].join("\n");
}

export function rawTableDdl(t: SourceTable, policy: TablePolicy): string {
  const qualified = `lsbd_raw.${q(t.name)}`;
  const lines: string[] = [];
  if (t.pk === null) lines.push("_rowid bigserial PRIMARY KEY");
  for (const c of [...t.columns].sort((a, b) => a.ordinal - b.ordinal)) {
    if (policy[c.name] === "drop") continue;
    // hmac columns are stored as text (base64 digest), everything else per type map.
    const pg = policy[c.name] === "hmac" ? "text" : pgTypeFor(c);
    if (c.name === t.pk) lines.push(`${q(c.name)} ${pg} NOT NULL PRIMARY KEY`);
    else {
      // hmac output may be null (unparseable SSN), so never NOT NULL.
      const notNull = !c.nullable && policy[c.name] !== "hmac";
      lines.push(`${q(c.name)} ${pg}${notNull ? " NOT NULL" : ""}`);
    }
  }
  lines.push(
    "_row_hash text NOT NULL",
    "_synced_at timestamptz NOT NULL DEFAULT now()",
    "_deleted_at timestamptz",
  );
  return [
    `CREATE TABLE IF NOT EXISTS ${qualified} (\n  ${lines.join(",\n  ")}\n);`,
    lockdown(qualified),
  ].join("\n");
}

export function bookkeepingDdl(): string {
  return [
    "CREATE SCHEMA IF NOT EXISTS lsbd_raw;",
    `CREATE TABLE IF NOT EXISTS lsbd_raw._sync_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  mode text NOT NULL,
  status text NOT NULL,
  tables_changed text[],
  inserted integer,
  updated integer,
  deleted integer,
  orphans_skipped integer,
  error text,
  blocked_tables text[],
  schema_drift text[]
);`,
    lockdown("lsbd_raw._sync_runs"),
    `CREATE TABLE IF NOT EXISTS lsbd_raw._sync_tables (
  table_name text PRIMARY KEY,
  source_count bigint,
  source_fingerprint bigint,
  raw_live_count bigint,
  last_changed_at timestamptz,
  last_synced_at timestamptz
);`,
    lockdown("lsbd_raw._sync_tables"),
  ].join("\n");
}
