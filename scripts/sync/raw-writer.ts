// scripts/sync/raw-writer.ts
//
// Writes to the lsbd_raw mirror schema. Every function takes a connected pg.Client and
// never opens or closes a transaction: the caller (the runner) owns BEGIN/COMMIT so each
// table is written atomically.

import type { Client } from "pg";
import { policyFor } from "./policy";
import { keyOf } from "./diff";
import type { KeyHash, SourceColumn, SourceTable } from "./types";

const MAX_BATCH_ROWS = 500;
const MAX_PARAMS = 65_000; // Postgres hard limit is 65,535 bind parameters
const DELETE_CHUNK = 5_000;

const q = (id: string): string => `"${id.replace(/"/g, '""')}"`;

/** Source columns that exist in lsbd_raw (policy "drop" columns are not mirrored). */
function rawColumns(t: SourceTable): SourceColumn[] {
  const policy = policyFor(t.name);
  return [...t.columns]
    .sort((a, b) => a.ordinal - b.ordinal)
    .filter((c) => policy[c.name] !== "drop");
}

/**
 * Bridge row -> raw row: `__h` becomes `_row_hash`; keys that are not raw columns are
 * dropped. Without a table, only the `__h` rename happens. An existing `_row_hash`
 * is honoured, so the function is idempotent.
 */
export function rowToRaw(row: Record<string, unknown>, t?: SourceTable): Record<string, unknown> {
  const allowed = t ? new Set(rawColumns(t).map((c) => c.name)) : null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "__h") out["_row_hash"] = v;
    else if (k === "_row_hash") {
      if (!("__h" in row)) out["_row_hash"] = v;
    } else if (allowed === null || allowed.has(k)) out[k] = v;
  }
  return out;
}

function pkColumn(t: SourceTable): SourceColumn {
  if (t.pk === null) throw new Error(`${t.name}: table has no primary key`);
  const c = t.columns.find((x) => x.name === t.pk);
  if (!c) throw new Error(`${t.name}: pk column ${t.pk} not in column list`);
  return c;
}

/** Live (not soft-deleted) keys + hashes, keys normalised through keyOf like the source side. */
export async function readRawKeys(c: Client, t: SourceTable): Promise<KeyHash[]> {
  const pk = pkColumn(t);
  const r = await c.query<{ k: string; h: string }>(
    `SELECT ${q(pk.name)}::text AS k, _row_hash AS h FROM lsbd_raw.${q(t.name)} WHERE _deleted_at IS NULL`,
  );
  return r.rows.map((x) => ({ k: keyOf(x.k, pk.type), h: x.h }));
}

interface Plan {
  cols: SourceColumn[];
  /** Column names in insert order, then _row_hash. */
  names: string[];
  batch: number;
}

function plan(t: SourceTable): Plan {
  const cols = rawColumns(t);
  const names = [...cols.map((x) => x.name), "_row_hash"];
  return { cols, names, batch: Math.max(1, Math.min(MAX_BATCH_ROWS, Math.floor(MAX_PARAMS / names.length))) };
}

function valuesSql(p: Plan, rows: number): string {
  const tuples: string[] = [];
  let n = 1;
  for (let r = 0; r < rows; r++) {
    const ph = p.cols.map((col) => {
      const s = `$${n++}`;
      return col.type.toLowerCase() === "image" ? `decode(${s}, 'base64')` : s;
    });
    ph.push(`$${n++}`); // _row_hash
    tuples.push(`(${ph.join(", ")})`);
  }
  return tuples.join(", ");
}

function paramsFor(p: Plan, t: SourceTable, rows: Record<string, unknown>[]): unknown[] {
  const out: unknown[] = [];
  for (const row of rows) {
    const raw = rowToRaw(row, t);
    const h = raw["_row_hash"];
    if (typeof h !== "string" || h === "") throw new Error(`${t.name}: row is missing __h / _row_hash`);
    for (const col of p.cols) {
      const v = raw[col.name];
      out.push(v === undefined ? null : v);
    }
    out.push(h);
  }
  return out;
}

async function insertRows(
  c: Client,
  t: SourceTable,
  rows: Record<string, unknown>[],
  conflict: string,
): Promise<number> {
  const p = plan(t);
  let total = 0;
  for (let i = 0; i < rows.length; i += p.batch) {
    const slice = rows.slice(i, i + p.batch);
    const sql =
      `INSERT INTO lsbd_raw.${q(t.name)} (${p.names.map(q).join(", ")}) VALUES ${valuesSql(p, slice.length)}` +
      conflict;
    const r = await c.query(sql, paramsFor(p, t, slice));
    total += r.rowCount ?? 0;
  }
  return total;
}

/**
 * Insert-or-update by primary key. A previously soft-deleted row is resurrected
 * (_deleted_at = NULL). Duplicate keys inside the input collapse, last one wins,
 * because ON CONFLICT cannot touch one row twice in a single statement.
 */
export async function upsertRaw(
  c: Client,
  t: SourceTable,
  rows: Record<string, unknown>[],
): Promise<number> {
  const pk = pkColumn(t);
  const p = plan(t);
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const v = row[pk.name];
    if (v === null || v === undefined) throw new Error(`${t.name}: row has null primary key`);
    byKey.set(keyOf(v, pk.type), row);
  }
  const sets = [
    ...p.cols.filter((x) => x.name !== pk.name).map((x) => `${q(x.name)} = EXCLUDED.${q(x.name)}`),
    "_row_hash = EXCLUDED._row_hash",
    "_synced_at = now()",
    "_deleted_at = NULL",
  ];
  return insertRows(
    c,
    t,
    [...byKey.values()],
    ` ON CONFLICT (${q(pk.name)}) DO UPDATE SET ${sets.join(", ")}`,
  );
}

/** Marks live rows with these (normalised text) keys deleted. Returns rows newly deleted. */
export async function softDelete(c: Client, t: SourceTable, keys: string[]): Promise<number> {
  const pk = pkColumn(t);
  let total = 0;
  for (let i = 0; i < keys.length; i += DELETE_CHUNK) {
    const r = await c.query(
      `UPDATE lsbd_raw.${q(t.name)} SET _deleted_at = now(), _synced_at = now()
       WHERE ${q(pk.name)}::text = ANY($1::text[]) AND _deleted_at IS NULL`,
      [keys.slice(i, i + DELETE_CHUNK)],
    );
    total += r.rowCount ?? 0;
  }
  return total;
}

/**
 * Full replace (used for tables without a usable PK): DELETE FROM, then insert.
 * Runs inside the caller's transaction so a failure leaves the table as it was.
 */
export async function replaceTable(
  c: Client,
  t: SourceTable,
  rows: Record<string, unknown>[],
): Promise<number> {
  await c.query(`DELETE FROM lsbd_raw.${q(t.name)}`);
  return insertRows(c, t, rows, "");
}
