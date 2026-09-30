import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { loadSecrets } from "../../scripts/lib/secrets";
import { readSchema, query, closeBridge } from "../../scripts/sync/mssql";
import { rowHashExpr } from "../../scripts/sync/sql-gen";
import { runSync } from "../../scripts/sync/run";
import type { SourceTable } from "../../scripts/sync/types";

// Live runner tests: real bridge (read-only) -> real lsbd_raw (writes only lsbd_raw).
// Run with:  $env:LSBD_IT='1'; npm run test:it

async function connect(): Promise<Client> {
  const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!url) throw new Error("SUPABASE_DB_URL_SESSION missing");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

async function sourceCount(t: string): Promise<number> {
  for await (const r of query<{ n: number }>(`SELECT COUNT(*) n FROM ${t}`)) return Number(r.n);
  throw new Error("no count row");
}

async function liveCount(c: Client, t: string): Promise<number> {
  const r = await c.query(`SELECT count(*)::int AS n FROM lsbd_raw."${t}" WHERE _deleted_at IS NULL`);
  return r.rows[0].n;
}

async function runCount(c: Client): Promise<number> {
  const r = await c.query(`SELECT count(*)::int AS n FROM lsbd_raw._sync_runs`);
  return r.rows[0].n;
}

describe.skipIf(process.env.LSBD_IT !== "1")("runSync (live)", () => {
  let c: Client;
  beforeAll(async () => {
    c = await connect();
  }, 60_000);
  afterAll(async () => {
    await c.query(`ALTER TABLE lsbd_raw."tblFees" DROP COLUMN IF EXISTS "ZZTest"`).catch(() => undefined);
    await c.end();
    await closeBridge();
  }, 60_000);

  it("full run of tblFees + tblTypes: raw live count equals source count", async () => {
    const s = await runSync({ mode: "full", tables: ["tblFees", "tblTypes"], transform: false, allowMassDelete: false });
    expect(s.status).toBe("ok");
    expect(s.runId).toBeGreaterThan(0);
    expect(s.blockedTables).toEqual([]);
    expect(await liveCount(c, "tblTypes")).toBe(await sourceCount("tblTypes"));
    expect(await liveCount(c, "tblFees")).toBe(await sourceCount("tblFees"));
    const run = await c.query(`SELECT status, finished_at FROM lsbd_raw._sync_runs WHERE id = $1`, [s.runId]);
    expect(run.rows[0].status).toBe("ok");
    expect(run.rows[0].finished_at).not.toBeNull();
    const st = await c.query(
      `SELECT source_count::int AS n, raw_live_count::int AS live FROM lsbd_raw._sync_tables WHERE table_name = 'tblTypes'`,
    );
    expect(st.rows[0].n).toBe(st.rows[0].live);
  }, 600_000);

  it("an immediate quick run of tblTypes reports no changed tables", async () => {
    const s = await runSync({ mode: "quick", tables: ["tblTypes"], transform: false, allowMassDelete: false });
    expect(s.status).toBe("ok");
    expect(s.tablesChanged).toEqual([]);
    expect(s.inserted + s.updated + s.deleted).toBe(0);
  }, 600_000);

  it("returns runId -1 without writing _sync_runs while another session holds the lock", async () => {
    const holder = await connect();
    try {
      await holder.query(`SELECT pg_advisory_lock(hashtext('lsbd_sync'))`);
      const before = await runCount(c);
      const s = await runSync({ mode: "quick", tables: ["tblTypes"], transform: false, allowMassDelete: false });
      expect(s.runId).toBe(-1);
      expect(s.status).toBe("skipped");
      expect(await runCount(c)).toBe(before);
    } finally {
      await holder.query(`SELECT pg_advisory_unlock(hashtext('lsbd_sync'))`).catch(() => undefined);
      await holder.end();
    }
  }, 300_000);

  it("after a failed run, the next quick run calls transforms with NULL (all domains) even with no changes", async () => {
    const calls: (string[] | null)[] = [];
    const record = async (_c: Client, changed: string[] | null) => {
      calls.push(changed);
      return 3;
    };
    const failing = await runSync(
      { mode: "full", tables: ["tblTypes"], transform: true, allowMassDelete: false },
      {
        readSchema,
        query,
        db: connect,
        runTransforms: async () => {
          throw new Error("transform boom");
        },
      },
    );
    expect(failing.status).toBe("failed");

    const rerun = await runSync(
      { mode: "quick", tables: ["tblTypes"], transform: true, allowMassDelete: false },
      { readSchema, query, db: connect, runTransforms: record },
    );
    expect(rerun.status).toBe("ok");
    expect(rerun.tablesChanged).toEqual([]);
    expect(calls).toEqual([null]);
    expect(rerun.orphansSkipped).toBe(3);

    // The previous run is now ok: no changes -> transforms are skipped again.
    const calm = await runSync(
      { mode: "quick", tables: ["tblTypes"], transform: true, allowMassDelete: false },
      { readSchema, query, db: connect, runTransforms: record },
    );
    expect(calm.status).toBe("ok");
    expect(calls).toEqual([null]);
  }, 600_000);

  it("schema drift: a new source column is added to lsbd_raw and reported", async () => {
    const real = (await readSchema()).map((t) => ({ ...t, columns: [...t.columns] }));
    const realFees = real.find((t) => t.name === "tblFees")!;
    const maxOrd = Math.max(...realFees.columns.map((x) => x.ordinal));
    const fakeFees: SourceTable = {
      ...realFees,
      columns: [
        ...realFees.columns,
        { name: "ZZTest", type: "nvarchar", maxLength: 100, precision: 0, scale: 0, nullable: true, ordinal: maxOrd + 1 },
      ],
    };
    const fakeSchema = real.map((t) => (t.name === "tblFees" ? fakeFees : t));
    const fakeHash = rowHashExpr(fakeFees.columns);
    const realHash = rowHashExpr(realFees.columns);

    // The column does not exist in MSSQL: rewrite the fake table's hash to the real one, and
    // give fetched rows a NULL ZZTest so they match the (fake) source column set.
    const fakeQuery = (async function* (sql: string) {
      const mapped = sql.split(fakeHash).join(realHash);
      const isFeeRows = mapped !== sql && mapped.includes(" AS __h ");
      for await (const r of query<Record<string, unknown>>(mapped)) {
        yield (isFeeRows ? { ...r, ZZTest: null } : r) as never;
      }
    }) as typeof query;

    const s = await runSync(
      { mode: "full", tables: ["tblFees"], transform: false, allowMassDelete: false },
      { readSchema: async () => fakeSchema, query: fakeQuery, db: connect },
    );
    expect(s.schemaDrift).toEqual(["tblFees.ZZTest added"]);
    expect(s.status).toBe("ok");
    const col = await c.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'lsbd_raw' AND table_name = 'tblFees' AND column_name = 'ZZTest'`,
    );
    expect(col.rows).toEqual([{ data_type: "text" }]);
    const run = await c.query(`SELECT schema_drift FROM lsbd_raw._sync_runs WHERE id = $1`, [s.runId]);
    expect(run.rows[0].schema_drift).toEqual(["tblFees.ZZTest added"]);
  }, 600_000);
});
