import { describe, it, expect, afterAll } from "vitest";
import { readSchema, query, closeBridge, bridgePid } from "../../scripts/sync/mssql";

// Live, read-only tests against LSBDSQL through PowerShell Direct.
// Run with:  $env:LSBD_IT='1'; npx vitest run tests/it/bridge.test.ts
// Throughput baseline (streams all of tblTransSplits): also set LSBD_IT_BASELINE=1.

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const r of it) out.push(r);
  return out;
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const v = await fn();
  return [v, performance.now() - t0];
}

describe.skipIf(process.env.LSBD_IT !== "1")("mssql bridge (live, read-only)", () => {
  afterAll(async () => {
    await closeBridge();
  }, 60_000);

  it("reuses one bridge process: the second query is < 50% of the first", async () => {
    await closeBridge(); // make sure the first call pays for spawn + session
    const [a, first] = await timed(() => collect(query<{ x: number }>("SELECT 1 AS x")));
    const pid = bridgePid();
    const [b, second] = await timed(() => collect(query<{ x: number }>("SELECT 2 AS x")));
    console.log(`bridge latency: first ${first.toFixed(0)} ms, second ${second.toFixed(0)} ms`);
    expect(a).toEqual([{ x: 1 }]);
    expect(b).toEqual([{ x: 2 }]);
    expect(pid).not.toBeNull();
    expect(bridgePid()).toBe(pid);
    expect(second).toBeLessThan(first * 0.5);
  }, 180_000);

  it("readSchema returns >= 80 tables; tblDenHyg has pk Key and an SSN column", async () => {
    const tables = await readSchema();
    expect(tables.length).toBeGreaterThanOrEqual(80);
    const dh = tables.find((t) => t.name === "tblDenHyg");
    expect(dh).toBeDefined();
    expect(dh!.pk).toBe("Key");
    expect(dh!.columns.some((c) => c.name === "SSN")).toBe(true);
    expect(dh!.rowCount).toBeGreaterThan(10_000);
    const key = dh!.columns.find((c) => c.name === "Key")!;
    expect(key.nullable).toBe(false);
    expect(key.type).toBe(key.type.toLowerCase());
    // Ordinals ascend within a table.
    const ords = dh!.columns.map((c) => c.ordinal);
    expect(ords).toEqual([...ords].sort((x, y) => x - y));
  }, 180_000);

  it("encodes datetime (.fff), money (invariant string) and NULL", async () => {
    const rows = await collect(
      query(
        "SELECT TOP 1 CAST('2026-09-30T09:58:18.477' AS datetime) AS d, CAST(12.3400 AS money) AS m, CAST(NULL AS nvarchar(5)) AS n",
      ),
    );
    expect(rows).toEqual([{ d: "2026-09-30T09:58:18.477", m: "12.3400", n: null }]);
  }, 180_000);

  it("encodes guid, bit, bytes, ints, float, decimal and non-ASCII text", async () => {
    const rows = await collect(
      query(
        "SELECT CAST('ABCDEF00-0000-0000-0000-00000000000A' AS uniqueidentifier) AS g, " +
          "CAST(1 AS bit) AS t, CAST(0 AS bit) AS f, CAST(0x00FF10 AS varbinary(3)) AS b, " +
          "CAST(-7 AS int) AS i, CAST(255 AS tinyint) AS ti, CAST(1.5 AS float) AS fl, " +
          "CAST(-0.10 AS decimal(9,2)) AS dec, CAST('2027-12-31' AS smalldatetime) AS sd, " +
          "N'Café ñ 日本 😀 \"q\" \\ tab\there' AS s",
      ),
    );
    expect(rows).toEqual([
      {
        g: "abcdef00-0000-0000-0000-00000000000a",
        t: true,
        f: false,
        b: "AP8Q",
        i: -7,
        ti: 255,
        fl: 1.5,
        dec: "-0.10",
        sd: "2027-12-31T00:00:00.000",
        s: 'Café ñ 日本 😀 "q" \\ tab\there',
      },
    ]);
  }, 180_000);

  it("refuses non-SELECT statements without sending them to the VM", async () => {
    await expect(collect(query("DELETE FROM tblFees"))).rejects.toThrow("non-SELECT refused");
    // The keyword check ignores string literals and bracketed identifiers...
    const ok = await collect(query("SELECT 'delete from x' AS [update]"));
    expect(ok).toEqual([{ update: "delete from x" }]);
    // ...but a quote inside a comment must not hide a statement. (Nonexistent table: harmless
    // even if the check were wrong.)
    await expect(
      collect(query("SELECT 1 AS x -- it's\nDELETE FROM dbo.__lsbd_no_such_table --'")),
    ).rejects.toThrow("non-SELECT refused");
    await expect(
      collect(query("SELECT 1 AS x /* /* */ ' */ DELETE FROM dbo.__lsbd_no_such_table --'")),
    ).rejects.toThrow("non-SELECT refused");
    await expect(
      collect(query("EXECUTE ('SELECT 1')")),
    ).rejects.toThrow("non-SELECT refused");
  }, 180_000);

  it("keeps serving after a SQL error and after an early break", async () => {
    await expect(collect(query("SELECT * FROM dbo.__lsbd_no_such_table"))).rejects.toThrow(
      /Invalid object name/i,
    );
    let seen = 0;
    for await (const r of query("SELECT TOP 12000 [Key] FROM dbo.tblDenHyg")) {
      void r;
      if (++seen === 3) break;
    }
    expect(seen).toBe(3);
    const rows = await collect(query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.tblFees"));
    expect(rows.length).toBe(1);
    expect(rows[0].n).toBeGreaterThan(0);
  }, 180_000);

  it("rejects the in-flight query if the bridge dies, then respawns on the next query", async () => {
    await collect(query("SELECT 1 AS warm"));
    const pid = bridgePid()!;
    // WAITFOR touches no user table, so killing the host mid-request strands nothing.
    const pending = collect(query("WAITFOR DELAY '00:00:03'; SELECT 1 AS x"));
    setTimeout(() => process.kill(pid), 1_000);
    await expect(pending).rejects.toThrow(/bridge exited/);
    const rows = await collect(query<{ x: number }>("SELECT 7 AS x"));
    expect(rows).toEqual([{ x: 7 }]);
    expect(bridgePid()).not.toBe(pid);
  }, 180_000);

  it("pages across 5,000-row boundaries without losing rows", async () => {
    const rows = await collect(
      query<{ k: number }>("SELECT TOP 12345 [Key] AS k FROM dbo.tblDenHyg ORDER BY [Key]"),
    );
    expect(rows.length).toBe(12_345);
    expect(new Set(rows.map((r) => r.k)).size).toBe(12_345);
  }, 180_000);

  it.skipIf(process.env.LSBD_IT_BASELINE !== "1")(
    "baseline: streams all of tblTransSplits",
    async () => {
      let n = 0;
      const [, ms] = await timed(async () => {
        for await (const r of query("SELECT * FROM dbo.tblTransSplits")) {
          void r;
          n++;
        }
      });
      console.log(`BASELINE tblTransSplits: ${n} rows in ${(ms / 1000).toFixed(1)} s`);
      expect(n).toBeGreaterThan(100_000);
    },
    900_000,
  );
});
