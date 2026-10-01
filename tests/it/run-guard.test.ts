import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { loadSecrets } from "../../scripts/lib/secrets";
import { connectPg } from "../../scripts/lib/pg";
import { readSchema, query, closeBridge } from "../../scripts/sync/mssql";
import { keysSql, rowsSql } from "../../scripts/sync/sql-gen";
import { runSync, exitCodeFor } from "../../scripts/sync/run";
import type { SourceTable } from "../../scripts/sync/types";

// Mass-delete guard and per-table failure isolation, end to end (Review Focus 4 and 5, R3).
// Test 1 commits 200 synthetic rows (keys >= 900000000) into lsbd_raw."tblTransTypes", then
// runs runSync with a fake source that returns ZERO keys for that table. The guard must block
// that table only (nothing written, _sync_tables untouched), tblFees must still sync, and the
// CLI maps "blocked" to exit 2. afterAll hard-deletes the synthetic rows.
// Test 2 fails a table mid-read and checks that nothing (data or fingerprint) is stored for it.
// Run with:  $env:LSBD_IT='1'; npm run test:it

const GUARDED = "tblTransTypes";
const SYNTH_MIN = 900000000;
const SYNTH_N = 200;

async function connect(): Promise<Client> {
  const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!url) throw new Error("SUPABASE_DB_URL_SESSION missing");
  const c = await connectPg(url, { applicationName: "lsbd-it" });
  return c;
}

async function liveCount(c: Client, t: string): Promise<number> {
  const r = await c.query(`SELECT count(*)::int AS n FROM lsbd_raw."${t}" WHERE _deleted_at IS NULL`);
  return r.rows[0].n;
}

async function sourceCount(t: string): Promise<number> {
  for await (const r of query<{ n: number }>(`SELECT COUNT(*) AS n FROM dbo.[${t}]`)) return Number(r.n);
  throw new Error("no count row");
}

async function syncTablesRow(c: Client, t: string): Promise<Record<string, unknown> | null> {
  const r = await c.query(
    `SELECT source_count::text, source_fingerprint::text, raw_live_count::text,
            last_changed_at::text, last_synced_at::text
     FROM lsbd_raw._sync_tables WHERE table_name = $1`,
    [t],
  );
  return r.rows[0] ?? null;
}

describe.skipIf(process.env.LSBD_IT !== "1")("runSync mass-delete guard (live)", () => {
  let c: Client;
  let schema: SourceTable[];

  beforeAll(async () => {
    c = await connect();
    schema = (await readSchema()).filter((t) => [GUARDED, "tblFees", "tblTypes"].includes(t.name));
    expect(schema.map((t) => t.name).sort()).toEqual(["tblFees", "tblTypes", GUARDED].sort());
    expect(schema.find((t) => t.name === GUARDED)!.pk).toBe("ID");
    const ids = Array.from({ length: SYNTH_N }, (_, i) => SYNTH_MIN + i);
    await c.query(
      `INSERT INTO lsbd_raw."${GUARDED}" ("ID", "TransType", _row_hash)
       SELECT id, 'synthetic', 'synthetic' FROM unnest($1::int[]) AS id
       ON CONFLICT ("ID") DO UPDATE SET _deleted_at = NULL`,
      [ids],
    ); // autocommit: committed on purpose (runSync uses its own connection)
  }, 180_000);

  afterAll(async () => {
    await c.query(`DELETE FROM lsbd_raw."${GUARDED}" WHERE "ID" >= $1`, [SYNTH_MIN]);
    await c.end();
    await closeBridge();
  }, 60_000);

  it("blocks the zero-key table, leaves it untouched, still syncs tblFees, exit code 2", async () => {
    const guarded = schema.find((t) => t.name === GUARDED)!;
    const zeroKeysSql = keysSql(guarded);
    const before = await liveCount(c, GUARDED);
    expect(before).toBeGreaterThanOrEqual(SYNTH_N);
    const guardedStateBefore = await syncTablesRow(c, GUARDED);
    const runStart = (await c.query(`SELECT now() AS t`)).rows[0].t as Date;

    const fakeQuery = (async function* (sql: string) {
      if (sql === zeroKeysSql) return; // the "bridge hiccup": no keys at all
      yield* query(sql);
    }) as typeof query;

    const summary = await runSync(
      { mode: "full", tables: [GUARDED, "tblFees"], transform: false, allowMassDelete: false },
      { readSchema: async () => schema, query: fakeQuery, db: connect },
    );

    expect(summary.status).toBe("blocked");
    expect(summary.blockedTables).toEqual([GUARDED]);
    expect(summary.runId).toBeGreaterThan(0);
    expect(await liveCount(c, GUARDED)).toBe(before);
    expect(await syncTablesRow(c, GUARDED)).toEqual(guardedStateBefore);
    expect(await liveCount(c, "tblFees")).toBe(await sourceCount("tblFees"));
    const fees = await c.query(`SELECT last_synced_at FROM lsbd_raw._sync_tables WHERE table_name = 'tblFees'`);
    expect((fees.rows[0].last_synced_at as Date).getTime()).toBeGreaterThanOrEqual(runStart.getTime());

    const run = await c.query(
      `SELECT status, blocked_tables FROM lsbd_raw._sync_runs WHERE id = $1`,
      [summary.runId],
    );
    expect(run.rows[0]).toEqual({ status: "blocked", blocked_tables: [GUARDED] });
    expect(exitCodeFor(summary.status)).toBe(2);
  }, 600_000);

  it("a table that fails mid-read stores neither data nor its fingerprint", async () => {
    const types = schema.find((t) => t.name === "tblTypes")!;
    const typesKeys = keysSql(types);
    const typesRows = rowsSql(types, "all");
    const hashes = async () =>
      (await c.query(`SELECT "ID", _row_hash FROM lsbd_raw."tblTypes" ORDER BY "ID"`)).rows;
    const hashesBefore = await hashes();
    const stateBefore = await syncTablesRow(c, "tblTypes");

    // Every key looks updated (bogus hash) -> the runner fetches rows -> the "bridge" dies
    // after one row.
    const fakeQuery = (async function* (sql: string) {
      if (sql === typesKeys) {
        for await (const r of query<{ k: unknown; h: string }>(sql)) yield { ...r, h: "X" } as never;
        return;
      }
      if (sql === typesRows) {
        let n = 0;
        for await (const r of query(sql)) {
          if (n++ === 1) throw new Error("bridge died mid-table");
          yield r as never;
        }
        return;
      }
      yield* query(sql);
    }) as typeof query;

    const s = await runSync(
      { mode: "full", tables: ["tblTypes"], transform: false, allowMassDelete: false },
      { readSchema: async () => schema, query: fakeQuery, db: connect },
    );
    expect(s.status).toBe("failed");
    expect(exitCodeFor(s.status)).toBe(1);
    expect(await hashes()).toEqual(hashesBefore);
    expect(await syncTablesRow(c, "tblTypes")).toEqual(stateBefore);
  }, 600_000);
});
