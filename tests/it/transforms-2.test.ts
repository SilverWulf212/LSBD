import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { loadSecrets } from "../../scripts/lib/secrets";
import { restoreSyntheticSequences } from "./sequences";

// Live tests of the Task 14 transform domains (relationships, operational, financial,
// compliance) and of the "lookup, not gate" change to the entities domain, against the real
// Supabase project. Every test runs inside BEGIN ... ROLLBACK with synthetic source keys
// >= 900000000, so nothing persists in lsbd_raw or lsbd.
// Run with:  $env:LSBD_IT='1'; npm run test:it

const K1 = 900000001;
const K2 = 900000002;
const MISSING = 999999999; // no Office / Individual has this key

// Synthetic uuids (…0009000000xx), never present in the source.
const INDV_UUID = "a0000000-0000-4000-8000-000900000011";
const PROF_UUID = "a0000000-0000-4000-8000-000900000012";
const DISC_UUID = "a0000000-0000-4000-8000-000900000013";

const T = 600_000; // the first run of a domain against an empty lsbd.* loads every row in-tx

async function run(c: Client, changed: string[] | null = null): Promise<number> {
  const r = await c.query<{ orphans: number }>(
    `CALL lsbd.run_transforms(changed_sources => $1::text[], orphans => 0)`,
    [changed],
  );
  return Number(r.rows[0].orphans);
}

async function count(c: Client, sql: string, params: unknown[] = []): Promise<number> {
  const r = await c.query<{ n: number }>(`SELECT (${sql})::int AS n`, params);
  return r.rows[0].n;
}

/** RFC 4122 v5 (SHA-1, name-based) uuid, computed independently of Postgres. */
function uuidV5(namespace: string, name: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"; // RFC 4122 NameSpace_URL

describe.skipIf(process.env.LSBD_IT !== "1")("lsbd.run_transforms, Task 14 domains (live)", () => {
  let c: Client;
  beforeAll(async () => {
    const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
    if (!url) throw new Error("SUPABASE_DB_URL_SESSION missing");
    c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();
    await c.query("SET statement_timeout = 0");
  }, 60_000);
  afterAll(async () => {
    await c.query("ROLLBACK").catch(() => undefined);
    await c.end();
  });

  async function inTx(fn: () => Promise<void>): Promise<void> {
    await c.query("BEGIN");
    try {
      await fn();
    } finally {
      await c.query("ROLLBACK");
      await restoreSyntheticSequences(c);
    }
  }

  it("(a) an OfficeAffiliation row pointing at a nonexistent office is an orphan: counted, not inserted", async () => {
    await inTx(async () => {
      const office = await count(c, `SELECT min("OFFICE_ID") FROM lsbd_raw."Office" WHERE _deleted_at IS NULL`);
      const base = await run(c, ["OfficeAffiliation"]);
      await c.query(
        `INSERT INTO lsbd_raw."OfficeAffiliation" ("OfficeAffiliation_ID", "OFFICE_ID", "DENTIST_ID", "OfficePermit", _row_hash)
         VALUES ($1, $2, 1, false, 'it-test'), ($3, $4, 1, true, 'it-test')`,
        [K1, MISSING, K2, office],
      );
      const orphans = await run(c, ["OfficeAffiliation"]);
      expect(orphans).toBeGreaterThanOrEqual(1);
      expect(orphans).toBe(base + 1);
      expect(await count(c, `SELECT count(*) FROM lsbd.office_affiliation WHERE id = $1`, [K1])).toBe(0);
      // the control row with a live office is inserted
      const ok = await c.query(`SELECT office_id, office_permit FROM lsbd.office_affiliation WHERE id = $1`, [K2]);
      expect(ok.rows).toEqual([{ office_id: office, office_permit: true }]);
      // per-relation bookkeeping for the reconcile report
      const q = await c.query<{ n: string; source_table: string }>(
        `SELECT n, source_table FROM lsbd._transform_quality WHERE target = 'lsbd.office_affiliation' AND kind = 'skipped'`,
      );
      expect(q.rows).toHaveLength(1);
      expect(q.rows[0].source_table).toBe("OfficeAffiliation");
      expect(Number(q.rows[0].n)).toBeGreaterThanOrEqual(1);
    });
  }, T);

  it("(b) a soft-deleted tblTransSplits row is removed on the next run; a deleted parent only unlinks", async () => {
    await inTx(async () => {
      await c.query(
        `INSERT INTO lsbd_raw."tblTransactions" ("ID", "TransId", "Key", "Licenseid", "Fee", _row_hash)
         VALUES ($1, $1, $1, 'IT-1', 10, 'it-test')`,
        [K1],
      );
      await c.query(
        `INSERT INTO lsbd_raw."tblTransSplits" ("ID", "TransId", "Key", "Fee", _row_hash)
         VALUES ($1, $3, $3, 4, 'it-test'), ($2, $3, $3, 6, 'it-test')`,
        [K1, K2, K1],
      );
      await run(c, ["tblTransactions", "tblTransSplits"]);
      const before = await c.query(
        `SELECT id, transaction_id FROM lsbd.transaction_splits WHERE id = ANY($1::int[]) ORDER BY id`,
        [[K1, K2]],
      );
      expect(before.rows).toEqual([
        { id: K1, transaction_id: K1 },
        { id: K2, transaction_id: K1 },
      ]);

      await c.query(`UPDATE lsbd_raw."tblTransSplits" SET _deleted_at = now() WHERE "ID" = $1`, [K1]);
      await run(c, ["tblTransSplits"]);
      expect(await count(c, `SELECT count(*) FROM lsbd.transaction_splits WHERE id = $1`, [K1])).toBe(0);
      expect(await count(c, `SELECT count(*) FROM lsbd.transaction_splits WHERE id = $1`, [K2])).toBe(1);

      // Parent transaction soft-deleted: the split stays, unlinked (no FK failure, no cascade).
      await c.query(`UPDATE lsbd_raw."tblTransactions" SET _deleted_at = now() WHERE "ID" = $1`, [K1]);
      await run(c, ["tblTransactions"]);
      expect(await count(c, `SELECT count(*) FROM lsbd.transactions WHERE id = $1`, [K1])).toBe(0);
      const after = await c.query(`SELECT id, transaction_id FROM lsbd.transaction_splits WHERE id = $1`, [K2]);
      expect(after.rows).toEqual([{ id: K2, transaction_id: null }]);
    });
  }, T);

  it("(c) money: a raw tblTransactions amount of 12.3400 lands as exact numeric 12.34", async () => {
    await inTx(async () => {
      await c.query(
        `INSERT INTO lsbd_raw."tblTransactions" ("ID", "TransId", "Fee", "Total", "Penalty", "AssFEE", "WellBeingFee", _row_hash)
         VALUES ($1, $1, '12.3400', 0.1::float8 + 0.2::float8, '0', NULL, '5.5', 'it-test')`,
        [K1],
      );
      await c.query(
        `INSERT INTO lsbd_raw."tblTransSplits" ("ID", "TransId", "Fee", _row_hash) VALUES ($1, $1, '12.3400', 'it-test')`,
        [K1],
      );
      await run(c, ["tblTransactions", "tblTransSplits"]);
      const t = await c.query(
        `SELECT fee = 12.34::numeric AS eq, pg_typeof(fee)::text AS ty, total = 0.3::numeric AS total_eq,
                pg_typeof(total)::text AS total_ty, penalty = 0 AS pen_eq, ass_fee IS NULL AS ass_null,
                well_being_fee = 5.5::numeric AS wb_eq
           FROM lsbd.transactions WHERE id = $1`,
        [K1],
      );
      expect(t.rows).toEqual([
        { eq: true, ty: "numeric", total_eq: true, total_ty: "numeric", pen_eq: true, ass_null: true, wb_eq: true },
      ]);
      const s = await c.query(
        `SELECT fee = 12.34::numeric AS eq, pg_typeof(fee)::text AS ty FROM lsbd.transaction_splits WHERE id = $1`,
        [K1],
      );
      expect(s.rows).toEqual([{ eq: true, ty: "numeric" }]);
    });
  }, T);

  it("(d) lookup, not gate: soft-deleting the dominant IndividualStatus keeps every individual and professional", async () => {
    await inTx(async () => {
      const top = await c.query<{ uid: string; n: number }>(
        `SELECT i."IndividualStatusID"::text AS uid, count(*)::int AS n
           FROM lsbd_raw."Individual" i
          WHERE i._deleted_at IS NULL AND i."IndividualStatusID" IS NOT NULL
          GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
      );
      const uid = top.rows[0].uid;
      await run(c, ["IndividualStatus"]); // settle: the baseline is the current transform output
      const indBefore = await count(c, `SELECT count(*) FROM lsbd.individual`);
      const profBefore = await count(c, `SELECT count(*) FROM lsbd.professional`);
      expect(await count(c, `SELECT count(*) FROM lsbd.individual WHERE individual_status_uuid = $1::uuid`, [uid])).toBeGreaterThan(0);

      await c.query(`UPDATE lsbd_raw."IndividualStatus" SET _deleted_at = now() WHERE "IndividualStatusID" = $1::uuid`, [uid]);
      await run(c, ["IndividualStatus"]);

      expect(await count(c, `SELECT count(*) FROM lsbd.individual`)).toBe(indBefore);
      expect(await count(c, `SELECT count(*) FROM lsbd.professional`)).toBe(profBefore);
      expect(await count(c, `SELECT count(*) FROM lsbd.individual WHERE individual_status_uuid = $1::uuid`, [uid])).toBe(0);
      expect(await count(c, `SELECT count(*) FROM lsbd.individual_status WHERE individual_status_uuid = $1::uuid`, [uid])).toBe(0);
    });
  }, T);

  it("(e) soft-deleting an Individual unlinks its professional, disciplinary and affiliation rows (no FK failure)", async () => {
    await inTx(async () => {
      await c.query(
        `INSERT INTO lsbd_raw."Individual" ("INDVID", "IndividualID", "LastName", _row_hash) VALUES ($1, $2::uuid, 'IT', 'it-test')`,
        [K1, INDV_UUID],
      );
      await c.query(
        `INSERT INTO lsbd_raw."Professional" ("Professional_ID", "ProfessionalID", "IndividualID", _row_hash)
         VALUES ($1, $2::uuid, $3::uuid, 'it-test')`,
        [K1, PROF_UUID, INDV_UUID],
      );
      await c.query(
        `INSERT INTO lsbd_raw."Disciplinary" ("Disciplinary_ID", "DisciplinaryID", "IndividualID", "Individual_ID", _row_hash)
         VALUES ($1, $2::uuid, $3::uuid, $1, 'it-test')`,
        [K1, DISC_UUID, INDV_UUID],
      );
      await c.query(
        `INSERT INTO lsbd_raw."IndividualAffiliation" ("IndividualAffiliation_ID", "DentistID", "IndividualID", "DENTID", "INDVID", _row_hash)
         VALUES ($1, $2::uuid, $2::uuid, $1, $1, 'it-test')`,
        [K1, INDV_UUID],
      );
      const changed = ["Individual", "Professional", "Disciplinary", "IndividualAffiliation"];
      await run(c, changed);
      const links = `SELECT (SELECT individual_id::text FROM lsbd.professional WHERE legacy_id = $1) AS prof,
                            (SELECT individual_id::text FROM lsbd.disciplinary WHERE legacy_id = $1) AS disc,
                            (SELECT dentist_id::text || '/' || individual_id::text FROM lsbd.individual_affiliation WHERE id = $1) AS ia,
                            (SELECT count(*)::int FROM lsbd.professional WHERE legacy_id = $1)
                          + (SELECT count(*)::int FROM lsbd.disciplinary WHERE legacy_id = $1)
                          + (SELECT count(*)::int FROM lsbd.individual_affiliation WHERE id = $1) AS n`;
      const before = await c.query(links, [K1]);
      expect(before.rows[0]).toEqual({ prof: INDV_UUID, disc: INDV_UUID, ia: `${INDV_UUID}/${INDV_UUID}`, n: 3 });

      await c.query(`UPDATE lsbd_raw."Individual" SET _deleted_at = now() WHERE "INDVID" = $1`, [K1]);
      await run(c, ["Individual"]);
      expect(await count(c, `SELECT count(*) FROM lsbd.individual WHERE indv_id = $1`, [K1])).toBe(0);
      const after = await c.query(links, [K1]);
      expect(after.rows[0]).toEqual({ prof: null, disc: null, ia: null, n: 3 });
      expect(
        await count(c, `SELECT count(*) FROM lsbd.individual_affiliation WHERE id = $1 AND dentist_id IS NULL AND individual_id IS NULL`, [K1]),
      ).toBe(1);
    });
  }, T);

  it("(f) a NULL DisciplinaryID gets the same derived uuid on every run (uuid v5 over Disciplinary_ID)", async () => {
    const derive = async (): Promise<{ derived: string; kept: string }> => {
      let out = { derived: "", kept: "" };
      await inTx(async () => {
        await c.query(
          `INSERT INTO lsbd_raw."Disciplinary" ("Disciplinary_ID", "DisciplinaryID", _row_hash)
           VALUES ($1, NULL, 'it-test'), ($2, $3::uuid, 'it-test')`,
          [K1, K2, DISC_UUID],
        );
        await run(c, ["Disciplinary"]);
        const r = await c.query<{ legacy_id: number; disciplinary_id: string }>(
          `SELECT legacy_id, disciplinary_id::text FROM lsbd.disciplinary WHERE legacy_id = ANY($1::int[]) ORDER BY legacy_id`,
          [[K1, K2]],
        );
        expect(r.rows.map((x) => x.legacy_id)).toEqual([K1, K2]);
        // a second run in the same transaction changes nothing
        await run(c, ["Disciplinary"]);
        const again = await c.query<{ disciplinary_id: string }>(
          `SELECT disciplinary_id::text FROM lsbd.disciplinary WHERE legacy_id = $1`,
          [K1],
        );
        expect(again.rows[0].disciplinary_id).toBe(r.rows[0].disciplinary_id);
        out = { derived: r.rows[0].disciplinary_id, kept: r.rows[1].disciplinary_id };
      });
      return out;
    };
    const first = await derive();
    const second = await derive(); // independent transaction: nothing carried over
    expect(second).toEqual(first);
    expect(first.derived).toBe(uuidV5(NS_URL, `lsbd:Disciplinary:Disciplinary_ID:${K1}`));
    expect(first.kept).toBe(DISC_UUID); // a real source uuid is kept as-is
  }, T);
});
