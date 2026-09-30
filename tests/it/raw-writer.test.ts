import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { loadSecrets } from "../../scripts/lib/secrets";
import type { SourceTable } from "../../scripts/sync/types";
import {
  readRawKeys,
  upsertRaw,
  softDelete,
  replaceTable,
  rowToRaw,
} from "../../scripts/sync/raw-writer";

// Live test against the REAL lsbd_raw."tblFees" (PK ID int), run after
// `npm run sync:bootstrap`. Everything happens inside BEGIN ... ROLLBACK with
// synthetic keys >= 900000000, so nothing persists.
// Run with:  $env:LSBD_IT='1'; npm run test:it

const col = (name: string, type: string, ordinal: number, nullable = true) => ({
  name,
  type,
  maxLength: 0,
  precision: 0,
  scale: 0,
  nullable,
  ordinal,
});

const TBL_FEES: SourceTable = {
  name: "tblFees",
  pk: "ID",
  rowCount: 0,
  columns: [col("ID", "int", 1, false), col("DenRegFee", "money", 2), col("HygRegFee", "money", 3)],
};

const K1 = 900000001;
const K2 = 900000002;

describe("rowToRaw (unit)", () => {
  it("moves __h to _row_hash and drops unknown keys", () => {
    const r = rowToRaw({ ID: 1, DenRegFee: "5.0000", bogus: 1, __h: "abc" }, TBL_FEES);
    expect(r).toEqual({ ID: 1, DenRegFee: "5.0000", _row_hash: "abc" });
  });
});

describe.skipIf(process.env.LSBD_IT !== "1")("raw writer (live lsbd_raw.tblFees)", () => {
  let c: Client;
  beforeAll(async () => {
    const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
    if (!url) throw new Error("SUPABASE_DB_URL_SESSION missing");
    c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();
  }, 60_000);
  afterAll(async () => {
    await c.query("ROLLBACK").catch(() => undefined);
    await c.end();
  });

  it("upsert, re-upsert, soft delete, resurrect, replaceTable", async () => {
    await c.query("BEGIN");
    try {
      const n = await upsertRaw(c, TBL_FEES, [
        { ID: K1, DenRegFee: "100.0000", HygRegFee: null, __h: "h1" },
        { ID: K2, DenRegFee: "200.5000", HygRegFee: "1.0000", __h: "h2" },
      ]);
      expect(n).toBe(2);

      const live = async () =>
        (await readRawKeys(c, TBL_FEES)).filter((x) => Number(x.k) >= 900000000);
      expect(await live()).toEqual(
        expect.arrayContaining([
          { k: String(K1), h: "h1" },
          { k: String(K2), h: "h2" },
        ]),
      );

      // same key, new hash and value -> updated in place
      await upsertRaw(c, TBL_FEES, [{ ID: K1, DenRegFee: "150.0000", HygRegFee: null, __h: "h1b" }]);
      const r1 = await c.query(
        `SELECT "DenRegFee"::text AS v, _row_hash FROM lsbd_raw."tblFees" WHERE "ID" = $1`,
        [K1],
      );
      expect(r1.rows[0]).toEqual({ v: "150.0000", _row_hash: "h1b" });

      // duplicate key inside one batch does not blow up (last wins)
      await upsertRaw(c, TBL_FEES, [
        { ID: K1, DenRegFee: "1.0000", __h: "d1" },
        { ID: K1, DenRegFee: "2.0000", __h: "d2" },
      ]);
      const rd = await c.query(`SELECT _row_hash FROM lsbd_raw."tblFees" WHERE "ID" = $1`, [K1]);
      expect(rd.rows[0]._row_hash).toBe("d2");

      // soft delete K2 -> only K1 stays live
      expect(await softDelete(c, TBL_FEES, [String(K2)])).toBe(1)
      const after = await live();
      expect(after.map((x) => x.k)).toEqual([String(K1)]);
      const del = await c.query(`SELECT _deleted_at FROM lsbd_raw."tblFees" WHERE "ID" = $1`, [K2]);
      expect(del.rows[0]._deleted_at).not.toBeNull();

      // soft-deleting an already-deleted key touches nothing
      expect(await softDelete(c, TBL_FEES, [String(K2)])).toBe(0);

      // resurrect
      await upsertRaw(c, TBL_FEES, [{ ID: K2, DenRegFee: "9.0000", __h: "h2c" }]);
      const res = await c.query(`SELECT _deleted_at, _row_hash FROM lsbd_raw."tblFees" WHERE "ID" = $1`, [K2]);
      expect(res.rows[0]._deleted_at).toBeNull();
      expect(res.rows[0]._row_hash).toBe("h2c");

      // replaceTable: wipes the table (inside our txn) and inserts only the given rows
      expect(await replaceTable(c, TBL_FEES, [{ ID: K1, DenRegFee: "3.0000", __h: "r1" }])).toBe(1);
      const cnt = await c.query(`SELECT count(*)::int AS n FROM lsbd_raw."tblFees"`);
      expect(cnt.rows[0].n).toBe(1);
    } finally {
      await c.query("ROLLBACK");
    }
  }, 120_000);
});
