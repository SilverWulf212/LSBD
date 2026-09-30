// Data loader + pure logic for the /admin/sync status page.
//
// Reads lsbd_raw._sync_runs / _sync_tables. anon and authenticated are
// REVOKEd on lsbd_raw, so this must only ever run SERVER-SIDE through the
// privileged POSTGRES_URL connection (src/lib/db). The query executor is
// injected so the loader is unit-testable without a database, and so this
// module never imports the DB client itself (keeps it out of any client
// bundle by construction). Never pass these rows to a client component.

import { centralClock } from "./central-time";

export type QueryFn = (text: string) => Promise<readonly Record<string, unknown>[]>;

export type SyncRun = {
  id: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  mode: string;
  status: string;
  tablesChanged: string[];
  inserted: number | null;
  updated: number | null;
  deleted: number | null;
  orphansSkipped: number | null;
  error: string | null;
  blockedTables: string[];
  schemaDrift: string[];
};

export type SyncTable = {
  tableName: string;
  sourceCount: number | null;
  rawLiveCount: number | null;
  lastChangedAt: Date | null;
  lastSyncedAt: Date | null;
};

export type SyncStatus = {
  runs: SyncRun[];
  tables: SyncTable[];
  latestOk: SyncRun | null;
  stale: boolean;
};

export const RUN_LIMIT = 20;
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
export const BUSINESS_START_HOUR = 8; // 08:00 Central, inclusive
export const BUSINESS_END_HOUR = 18; // 18:00 Central, exclusive

const RUN_COLUMNS = `id, started_at, finished_at, mode, status, tables_changed,
  inserted, updated, deleted, orphans_skipped, error, blocked_tables, schema_drift`;

export const SYNC_RUNS_SQL = `SELECT ${RUN_COLUMNS}
FROM lsbd_raw._sync_runs
ORDER BY started_at DESC, id DESC
LIMIT ${RUN_LIMIT}`;

// Separate query: the latest ok run may be older than the last 20 runs.
export const LATEST_OK_SQL = `SELECT ${RUN_COLUMNS}
FROM lsbd_raw._sync_runs
WHERE status = 'ok'
ORDER BY started_at DESC, id DESC
LIMIT 1`;

export const SYNC_TABLES_SQL = `SELECT table_name, source_count, raw_live_count, last_changed_at, last_synced_at
FROM lsbd_raw._sync_tables
ORDER BY table_name`;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v); // bigint columns arrive as strings
  return Number.isFinite(n) ? n : null;
}

function toDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toStrArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  // Defensive: a driver without array parsing returns "{a,b}".
  if (typeof v === "string" && v.startsWith("{") && v.endsWith("}")) {
    const inner = v.slice(1, -1);
    return inner ? inner.split(",").map((s) => s.replace(/^"|"$/g, "")) : [];
  }
  return [];
}

function toStr(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

export function mapRunRow(r: Record<string, unknown>): SyncRun {
  return {
    id: toNum(r.id) ?? 0,
    startedAt: toDate(r.started_at),
    finishedAt: toDate(r.finished_at),
    mode: toStr(r.mode) ?? "",
    status: toStr(r.status) ?? "",
    tablesChanged: toStrArr(r.tables_changed),
    inserted: toNum(r.inserted),
    updated: toNum(r.updated),
    deleted: toNum(r.deleted),
    orphansSkipped: toNum(r.orphans_skipped),
    error: toStr(r.error),
    blockedTables: toStrArr(r.blocked_tables),
    schemaDrift: toStrArr(r.schema_drift),
  };
}

export function mapTableRow(r: Record<string, unknown>): SyncTable {
  return {
    tableName: toStr(r.table_name) ?? "",
    sourceCount: toNum(r.source_count),
    rawLiveCount: toNum(r.raw_live_count),
    lastChangedAt: toDate(r.last_changed_at),
    lastSyncedAt: toDate(r.last_synced_at),
  };
}

/** Central business hours: Mon–Fri, 08:00 ≤ t < 18:00 America/Chicago. */
export function isCentralBusinessHours(now: Date): boolean {
  const { weekday, hour } = centralClock(now);
  return weekday >= 1 && weekday <= 5 && hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
}

/**
 * Red-banner rule: during Central business hours on a weekday, the latest
 * `ok` run must be at most 2 hours old. The run's age is measured from when it
 * finished (falling back to when it started). No ok run at all counts as stale
 * during business hours. Outside business hours the banner never shows.
 */
export function isSyncStale(
  latestOk: Pick<SyncRun, "startedAt" | "finishedAt"> | null,
  now: Date
): boolean {
  if (!isCentralBusinessHours(now)) return false;
  const at = latestOk ? (latestOk.finishedAt ?? latestOk.startedAt) : null;
  if (!at) return true;
  return now.getTime() - at.getTime() > STALE_AFTER_MS;
}

export async function loadSyncStatus(query: QueryFn, now: Date = new Date()): Promise<SyncStatus> {
  const [runRows, okRows, tableRows] = await Promise.all([
    query(SYNC_RUNS_SQL),
    query(LATEST_OK_SQL),
    query(SYNC_TABLES_SQL),
  ]);
  const latestOk = okRows[0] ? mapRunRow(okRows[0]) : null;
  return {
    runs: runRows.map(mapRunRow),
    tables: tableRows.map(mapTableRow),
    latestOk,
    stale: isSyncStale(latestOk, now),
  };
}
