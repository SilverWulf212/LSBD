// scripts/lib/etl-helpers.ts
//
// Shared helpers for the B-3 / B-4 ETL scripts. Streaming JSONL reader,
// batched INSERT, type coercion, and lookup-map builders.

import * as fs from "node:fs";
import * as readline from "node:readline";
import { Client } from "pg";

export const DEFAULT_BATCH = 500;

export function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
export function strOrEmpty(v: unknown): string {
  return strOrNull(v) ?? "";
}
export function intOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
export function boolOrNull(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toUpperCase();
  if (s === "Y" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "FALSE" || s === "0") return false;
  return null;
}
export function tsOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}
export function decOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}
export function floatOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function readJsonl<T = Record<string, unknown>>(file: string): Promise<T[]> {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  const rows: T[] = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line) as T);
  }
  return rows;
}

export async function batchInsert(
  client: Client,
  table: string,
  cols: string[],
  rows: unknown[][],
  batchSize: number = DEFAULT_BATCH
): Promise<void> {
  if (rows.length === 0) return;
  const colCount = cols.length;
  for (let off = 0; off < rows.length; off += batchSize) {
    const batch = rows.slice(off, off + batchSize);
    const params: unknown[] = [];
    const placeholders: string[] = [];
    for (const row of batch) {
      const ph: string[] = [];
      for (let c = 0; c < colCount; c++) {
        params.push(row[c]);
        ph.push(`$${params.length}`);
      }
      placeholders.push(`(${ph.join(",")})`);
    }
    await client.query(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES ${placeholders.join(",")}`,
      params
    );
  }
}

/**
 * Stream rows from a JSONL file, map each to a target tuple, and flush in
 * batches. Best for large source files (transactions, transaction_splits).
 */
export async function streamLoad<T>(
  client: Client,
  jsonlFile: string,
  table: string,
  cols: string[],
  mapper: (src: T) => unknown[] | null,
  opts: { batchSize?: number; onProgress?: (loaded: number) => void } = {}
): Promise<number> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH;
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlFile),
    crlfDelay: Infinity,
  });
  let buffer: unknown[][] = [];
  let loaded = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const src = JSON.parse(line) as T;
    const row = mapper(src);
    if (row == null) continue;
    buffer.push(row);
    if (buffer.length >= batchSize) {
      await batchInsert(client, table, cols, buffer, batchSize);
      loaded += buffer.length;
      buffer = [];
      if (opts.onProgress) opts.onProgress(loaded);
    }
  }
  if (buffer.length > 0) {
    await batchInsert(client, table, cols, buffer, batchSize);
    loaded += buffer.length;
  }
  return loaded;
}

export async function resetSequence(
  client: Client,
  table: string,
  col: string = "id"
): Promise<void> {
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence($1, $2),
       COALESCE((SELECT MAX(${col}) FROM ${table}), 1),
       true
     )`,
    [table, col]
  );
}

export function lcOrNull(v: unknown): string | null {
  const s = strOrNull(v);
  return s == null ? null : s.toLowerCase();
}
