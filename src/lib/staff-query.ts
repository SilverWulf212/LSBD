// Paging and row-conversion helpers for the staff read-only screens (D13).
// Relative imports only: vitest has no `@/` alias.
import type { RoQueryFn } from "./db/lsbd-ro";
import { firstParam } from "./public-verify-helpers";

export const STAFF_PAGE_SIZE = 25;
export const STAFF_MAX_PAGE = 10000;

export type RawSearchParams = Record<string, string | string[] | undefined>;
export type Paged<T> = { rows: T[]; total: number; page: number; pageSize: number };

/** Integer 1..STAFF_MAX_PAGE; anything else is page 1. */
export function parsePage(v: string | string[] | undefined): number {
  const s = firstParam(v);
  if (!/^\d{1,5}$/.test(s)) return 1;
  const n = Number(s);
  return n >= 1 && n <= STAFF_MAX_PAGE ? n : 1;
}

/** First value, trimmed; "" if it has a control character or is longer than `max`. */
export function cleanText(v: string | string[] | undefined, max = 100): string {
  const s = firstParam(v);
  if (s.length > max || /[\u0000-\u001f\u007f]/.test(s)) return "";
  return s;
}

export function lastPage(total: number, pageSize = STAFF_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Page 1, the last page, and the page with its neighbours; "gap" between non-neighbours. */
export function pageWindow(page: number, last: number): (number | "gap")[] {
  const keep = new Set<number>([1, last]);
  for (let p = page - 1; p <= page + 1; p++) if (p >= 1 && p <= last) keep.add(p);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (prev && p - prev > 1) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}

export function pageHref(basePath: string, params: Record<string, string | undefined>, page: number): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function rangeText(page: number, pageSize: number, total: number, count: number): string {
  const from = (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + count;
  const f = (n: number) => n.toLocaleString("en-US");
  return `Showing ${f(from)}–${f(to)} of ${f(total)}`;
}

/**
 * `sql` has no LIMIT and selects `count(*) OVER() AS total`. A page past the last row
 * falls back to page 1 (one extra query).
 */
export async function runPaged<T>(
  q: RoQueryFn,
  sql: string,
  params: readonly unknown[],
  page: number,
  map: (r: Record<string, unknown>) => T,
): Promise<Paged<T>> {
  const text = `${sql}\nLIMIT ${STAFF_PAGE_SIZE} OFFSET $${params.length + 1}`;
  let rows = await q(text, [...params, (page - 1) * STAFF_PAGE_SIZE]);
  if (rows.length === 0 && page > 1) {
    page = 1;
    rows = await q(text, [...params, 0]);
  }
  return {
    rows: rows.map(map),
    total: rows.length ? (rowNum(rows[0].total) ?? 0) : 0,
    page,
    pageSize: STAFF_PAGE_SIZE,
  };
}

export function rowStr(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}
export function rowIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}
export function rowNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export function rowBool(v: unknown): boolean | null {
  return v === null || v === undefined ? null : Boolean(v);
}
