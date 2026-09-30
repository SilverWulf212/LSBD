// scripts/sync/mssql.ts
//
// TypeScript side of the read-only PowerShell Direct bridge (scripts/sync/bridge.ps1).
// One long-lived bridge process per sync run, spawned lazily on first use. Requests are
// serialised: one in flight at a time, the rest queue behind it.
//
// Integrity rules: every reply must end with done.count equal to the rows received, every
// non-empty stdout line must be a protocol message for the active request, and a request
// that receives no line for SYNC_BRIDGE_TIMEOUT_MS (default 15 min) kills the bridge. Any
// violation rejects the query; the next query respawns the bridge.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";
import type { SourceColumn, SourceTable } from "./types";

const BRIDGE_PS1 = path.resolve(__dirname, "bridge.ps1");
const STDERR_CAP = 64 * 1024;
const HIGH_WATER = 20_000; // buffered rows before we stop reading the bridge's stdout
const LOW_WATER = 2_000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

type Msg = { id?: unknown; row?: unknown; done?: unknown; count?: unknown; error?: unknown };
type SpawnFn = () => ChildProcessWithoutNullStreams;

function spawnPowerShell(): ChildProcessWithoutNullStreams {
  return spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", BRIDGE_PS1, "-Mode", "serve"],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
}

let spawnFn: SpawnFn = spawnPowerShell;

/** Test hook: replace the child-process factory (null restores powershell.exe). */
export function _setSpawnForTests(fn: SpawnFn | null): void {
  spawnFn = fn ?? spawnPowerShell;
}

function requestTimeoutMs(): number {
  const raw = process.env.SYNC_BRIDGE_TIMEOUT_MS;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/** JSON with every non-ASCII char \u-escaped, so the console code page can't matter. */
function asciiJson(v: unknown): string {
  return JSON.stringify(v).replace(
    /[\u007f-￿]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

interface Active {
  id: number;
  rows: unknown[];
  received: number;
  finished: boolean;
  error: Error | null;
  wake: (() => void) | null;
}

class Bridge {
  readonly proc: ChildProcessWithoutNullStreams;
  private buf = "";
  private stderr = "";
  private nextId = 1;
  private chain: Promise<void> = Promise.resolve();
  private active: Active | null = null;
  private paused = false;
  private timer: NodeJS.Timeout | null = null;
  private timeoutMs = DEFAULT_TIMEOUT_MS;
  private lastActivity = 0;
  exitError: Error | null = null;
  readonly exited: Promise<void>;

  constructor() {
    this.proc = spawnFn();
    this.proc.stdout.setEncoding("utf8");
    this.proc.stderr.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.proc.stderr.on("data", (chunk: string) => {
      this.stderr = (this.stderr + chunk).slice(-STDERR_CAP);
    });
    this.proc.stdin.on("error", () => {
      /* surfaced through the exit handler */
    });
    this.exited = new Promise<void>((resolve) => {
      let gone = false;
      const onGone = (code: number | null, err?: Error) => {
        if (gone) return;
        gone = true;
        const detail = this.stderr.trim() || err?.message || "";
        this.fail(
          new Error(`bridge exited (code ${code ?? "null"})${detail ? `: ${detail}` : ""}`),
          false,
        );
        resolve();
      };
      this.proc.on("error", (err) => onGone(null, err));
      this.proc.on("close", (code: number | null) => onGone(code));
    });
  }

  /**
   * Marks the bridge dead (first error wins), rejects the active request, detaches the
   * singleton so the next query respawns, and optionally kills the child.
   */
  private fail(err: Error, kill: boolean) {
    if (!this.exitError) this.exitError = err;
    if (singleton === this) singleton = null;
    this.clearTimer();
    const a = this.active;
    if (a && !a.finished) {
      a.error = this.exitError;
      a.finished = true;
      a.wake?.();
    }
    if (kill) {
      try {
        this.proc.kill();
      } catch {
        /* already gone */
      }
    }
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Keeps one idle timer per waiting request. Activity only stamps lastActivity (no timer
   * churn per row); the timer re-checks the gap when it fires. Paused time (our own
   * backpressure) does not count.
   */
  private arm() {
    const a = this.active;
    if (!a || a.finished || this.paused || this.exitError) {
      this.clearTimer();
      return;
    }
    if (this.timer) return;
    const wait = Math.max(0, this.lastActivity + this.timeoutMs - Date.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      const cur = this.active;
      if (!cur || cur.finished || this.paused || this.exitError) return;
      if (Date.now() - this.lastActivity >= this.timeoutMs) {
        this.fail(new Error(`bridge: timeout (no output for ${this.timeoutMs} ms)`), true);
      } else {
        this.arm();
      }
    }, wait);
  }

  private onData(chunk: string) {
    this.buf += chunk;
    let nl: number;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl).replace(/\r$/, "");
      this.buf = this.buf.slice(nl + 1);
      if (this.exitError) return;
      this.onLine(line);
    }
  }

  private protocolError(what: string) {
    this.fail(new Error(`bridge: ${what}`), true);
  }

  private onLine(line: string) {
    if (line.trim() === "") return;
    this.lastActivity = Date.now();
    let msg: Msg;
    try {
      msg = JSON.parse(line) as Msg;
    } catch {
      // Length only: the line may carry row data.
      return this.protocolError(`unparseable stdout line (${line.length} chars)`);
    }
    if (msg === null || typeof msg !== "object" || Array.isArray(msg)) {
      return this.protocolError(`unparseable stdout line (${line.length} chars)`);
    }
    const a = this.active;
    if (!a || a.finished) return this.protocolError("output with no request in flight");
    if (msg.id !== a.id) return this.protocolError(`reply id ${String(msg.id)} while waiting for ${a.id}`);
    if ("row" in msg) {
      a.received++;
      a.rows.push(msg.row);
      if (a.rows.length >= HIGH_WATER && !this.paused) {
        this.paused = true;
        this.proc.stdout.pause();
        this.clearTimer();
      }
    } else if (msg.error !== undefined) {
      a.error = new Error(String(msg.error));
      a.finished = true;
    } else if (msg.done === true) {
      if (msg.count !== a.received) {
        a.error = new Error(
          `bridge: row count mismatch (bridge sent ${String(msg.count)}, received ${a.received})`,
        );
      }
      a.finished = true;
    } else {
      return this.protocolError("reply with no row, done or error");
    }
    if (a.finished) this.clearTimer();
    else this.arm();
    a.wake?.();
  }

  private resumeIfDrained(a: Active) {
    if (this.paused && a.rows.length <= LOW_WATER) {
      this.paused = false;
      this.proc.stdout.resume();
      this.lastActivity = Date.now();
      this.arm();
    }
  }

  /** Runs one request; yields its rows. Requests queue behind each other. */
  async *run<T>(sql: string): AsyncGenerator<T> {
    let release!: () => void;
    const prev = this.chain;
    this.chain = new Promise<void>((r) => (release = r));
    await prev;
    try {
      if (this.exitError) throw this.exitError;
      const a: Active = {
        id: this.nextId++,
        rows: [],
        received: 0,
        finished: false,
        error: null,
        wake: null,
      };
      this.active = a;
      this.timeoutMs = requestTimeoutMs();
      this.proc.stdin.write(asciiJson({ id: a.id, sql }) + "\n");
      this.lastActivity = Date.now();
      this.arm();
      let completed = false;
      try {
        for (;;) {
          if (a.rows.length > 0) {
            const batch = a.rows;
            a.rows = [];
            this.resumeIfDrained(a);
            for (const r of batch) yield r as T;
            continue;
          }
          if (a.finished) {
            if (a.error) throw a.error;
            completed = true;
            return;
          }
          await new Promise<void>((r) => (a.wake = r));
          a.wake = null;
        }
      } finally {
        if (!completed && !a.finished) {
          // Consumer stopped early: discard the rest of this reply before the next request.
          while (!a.finished) {
            a.rows = [];
            this.resumeIfDrained(a);
            await new Promise<void>((r) => (a.wake = r));
            a.wake = null;
          }
        }
        a.rows = [];
        this.resumeIfDrained(a);
        this.clearTimer();
        if (this.active === a) this.active = null;
      }
    } finally {
      release();
    }
  }

  async quit(timeoutMs = 60_000): Promise<void> {
    // Wait for any in-flight or queued request, then ask the bridge to exit.
    await this.chain.catch(() => undefined);
    if (!this.exitError) {
      try {
        this.proc.stdin.write(asciiJson({ id: this.nextId++, quit: true }) + "\n");
        this.proc.stdin.end();
      } catch {
        /* already gone */
      }
    }
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<"timeout">((r) => (timer = setTimeout(() => r("timeout"), timeoutMs)));
    const res = await Promise.race([this.exited.then(() => "exited" as const), timedOut]);
    clearTimeout(timer);
    if (res === "timeout") {
      this.proc.kill();
      await this.exited;
    }
  }
}

let singleton: Bridge | null = null;

function getBridge(): Bridge {
  if (!singleton) singleton = new Bridge();
  return singleton;
}

/**
 * Runs one SELECT through the bridge and yields each row. Throws on an error reply, a row
 * count mismatch, a protocol violation, an idle timeout, or (with its stderr) if the bridge
 * process dies. The bridge refuses non-SELECT SQL.
 */
export async function* query<T = Record<string, unknown>>(sql: string): AsyncGenerator<T> {
  yield* getBridge().run<T>(sql);
}

/** Sends quit and awaits exit. Safe to call when no bridge is running. */
export async function closeBridge(): Promise<void> {
  const b = singleton;
  if (!b) return;
  singleton = null;
  await b.quit();
}

/** PID of the running bridge process, or null. For tests and diagnostics. */
export function bridgePid(): number | null {
  return singleton?.proc.pid ?? null;
}

// ---------------------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------------------

export const SCHEMA_SQL = `
SELECT t.name AS tbl,
       c.name AS col,
       LOWER(TYPE_NAME(c.user_type_id)) AS typ,
       c.max_length AS maxLength,
       c.precision AS [precision],
       c.scale AS scale,
       c.is_nullable AS nullable,
       c.column_id AS ordinal,
       ISNULL(rc.n, 0) AS [rowCount],
       pk.pkcol AS pkcol,
       ISNULL(pk.pkcols, 0) AS pkcols
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
LEFT JOIN (
  SELECT p.object_id, SUM(p.rows) AS n
  FROM sys.partitions p
  WHERE p.index_id IN (0, 1)
  GROUP BY p.object_id
) rc ON rc.object_id = t.object_id
LEFT JOIN (
  SELECT i.object_id, MIN(COL_NAME(ic.object_id, ic.column_id)) AS pkcol, COUNT(*) AS pkcols
  FROM sys.indexes i
  JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  WHERE i.is_primary_key = 1
  GROUP BY i.object_id
) pk ON pk.object_id = t.object_id
WHERE t.is_ms_shipped = 0
  AND SCHEMA_NAME(t.schema_id) = 'dbo'
ORDER BY t.name, c.column_id`;

interface SchemaRow {
  tbl: string;
  col: string;
  typ: string;
  maxLength: number;
  precision: number;
  scale: number;
  nullable: boolean;
  ordinal: number;
  rowCount: number;
  pkcol: string | null;
  pkcols: number;
}

/** Reads dbo user tables, columns, single-column PKs and row counts from the source catalog. */
export async function readSchema(): Promise<SourceTable[]> {
  const byName = new Map<string, SourceTable>();
  for await (const r of query<SchemaRow>(SCHEMA_SQL)) {
    let t = byName.get(r.tbl);
    if (!t) {
      t = {
        name: r.tbl,
        pk: r.pkcols === 1 ? r.pkcol : null,
        columns: [],
        rowCount: Number(r.rowCount),
      };
      byName.set(r.tbl, t);
    }
    const col: SourceColumn = {
      name: r.col,
      type: r.typ,
      maxLength: r.maxLength,
      precision: r.precision,
      scale: r.scale,
      nullable: r.nullable,
      ordinal: r.ordinal,
    };
    t.columns.push(col);
  }
  const tables = [...byName.values()];
  for (const t of tables) t.columns.sort((a, b) => a.ordinal - b.ordinal);
  return tables;
}
