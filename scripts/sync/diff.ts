import type { KeyHash } from "./types";

const INT_TYPES = new Set(["int", "smallint", "tinyint"]);

/**
 * Canonical string form of a primary-key value, stable across read paths.
 * - uniqueidentifier: lowercased (MSSQL returns either case depending on path)
 * - int/smallint/tinyint: decimal string
 * - everything else (nvarchar, nchar, varchar, char): String(v), unmodified.
 *   No trim: trailing spaces / nchar padding are part of the key.
 */
export function keyOf(v: unknown, pkType: string): string {
  if (v === null || v === undefined) throw new Error("keyOf: null key");
  const t = pkType.toLowerCase();
  if (t === "uniqueidentifier") return String(v).toLowerCase();
  if (INT_TYPES.has(t)) {
    const blank = typeof v === "string" && v.trim() === "";
    const n = blank ? NaN : Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error("keyOf: invalid integer key");
    return String(Math.trunc(n));
  }
  return String(v);
}

/**
 * O(n) key/hash diff. Duplicate keys within either side (possible under NOLOCK
 * reads) count once; if hashes differ the last occurrence wins. Output order:
 * source order for inserted/updated, target order for deleted.
 */
export function diffKeys(
  source: KeyHash[],
  target: KeyHash[],
): { inserted: string[]; updated: string[]; deleted: string[] } {
  // Map.set on an existing key keeps its original insertion position.
  const src = new Map<string, string>();
  for (const { k, h } of source) src.set(k, h);
  const tgt = new Map<string, string>();
  for (const { k, h } of target) tgt.set(k, h);

  const inserted: string[] = [];
  const updated: string[] = [];
  for (const [k, h] of src) {
    const th = tgt.get(k);
    if (th === undefined) inserted.push(k);
    else if (th !== h) updated.push(k);
  }
  const deleted: string[] = [];
  for (const k of tgt.keys()) if (!src.has(k)) deleted.push(k);
  return { inserted, updated, deleted };
}

/**
 * True means BLOCK: a table with more than 100 live rows would lose more than
 * half of them, which almost certainly means a broken source read.
 */
export function massDeleteGuard(liveCount: number, deleteCount: number): boolean {
  return liveCount > 100 && deleteCount > liveCount * 0.5;
}
