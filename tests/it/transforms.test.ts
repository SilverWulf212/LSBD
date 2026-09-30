import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { loadSecrets } from "../../scripts/lib/secrets";
import { restoreSyntheticSequences } from "./sequences";

// Live tests of lsbd.run_transforms (Task 11) against the real Supabase project.
// Every test runs inside BEGIN ... ROLLBACK and uses synthetic tblDenHyg keys
// >= 900000000, so nothing persists (neither in lsbd_raw nor in lsbd).
// Run with:  $env:LSBD_IT='1'; npm run test:it

const K1 = 900000001;
const K2 = 900000002;
const K3 = 900000003;
const LIC = "900001";
const MISSING_INDIVIDUAL = 999999999; // no Individual has INDVID 999999999

const T = 600_000; // a full run on an empty lsbd.* is ~20k rows per table

// Individual uuid values in (g) are synthetic too (…000900000001/2).

interface RawDenHyg {
  Key: number;
  LICENSEID: string;
  Type: string;
  LASTName: string;
  DateUntil?: string;
  IndividualID_?: number | null;
  SSN?: string | null;
}

async function insertRaw(c: Client, r: RawDenHyg): Promise<void> {
  await c.query(
    `INSERT INTO lsbd_raw."tblDenHyg"
       ("Key", "LICENSEID", "Type", "STATUS", "FIRSTName", "LASTName", "DateUntil", "IndividualID_", "SSN", _row_hash)
     VALUES ($1, $2, $3, 'ACT', 'TEST', $4, $5::timestamp, $6, $7, 'it-test')`,
    [r.Key, r.LICENSEID, r.Type, r.LASTName, r.DateUntil ?? null, r.IndividualID_ ?? null, r.SSN ?? null],
  );
}

async function run(c: Client, changed: string[] | null = null): Promise<number> {
  const r = await c.query<{ orphans: number }>(
    `CALL lsbd.run_transforms(changed_sources => $1::text[], orphans => 0)`,
    [changed],
  );
  return Number(r.rows[0].orphans);
}

async function licenseStats(c: Client): Promise<{ ins: number; upd: number; del: number }> {
  const r = await c.query<{ ins: string; upd: string; del: string }>(
    `SELECT n_tup_ins AS ins, n_tup_upd AS upd, n_tup_del AS del
       FROM pg_stat_xact_user_tables WHERE schemaname = 'lsbd' AND relname = 'license'`,
  );
  const row = r.rows[0] ?? { ins: "0", upd: "0", del: "0" };
  return { ins: Number(row.ins), upd: Number(row.upd), del: Number(row.del) };
}

describe.skipIf(process.env.LSBD_IT !== "1")("lsbd.run_transforms (live)", () => {
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

  it("(a) one license + one person per tblDenHyg row; updates propagate without duplicating", async () => {
    await inTx(async () => {
      await insertRaw(c, { Key: K1, LICENSEID: LIC, Type: "D", LASTName: "ALPHA", SSN: "it-hash-1" });
      await insertRaw(c, { Key: K2, LICENSEID: LIC, Type: "H", LASTName: "BRAVO" });
      await run(c);

      const lic = await c.query<{ legacy_key: number; type: string; person_id: number | null }>(
        `SELECT legacy_key, type::text AS type, person_id FROM lsbd.license WHERE license_id = $1 ORDER BY legacy_key`,
        [LIC],
      );
      expect(lic.rows.map((r) => [r.legacy_key, r.type])).toEqual([
        [K1, "D"],
        [K2, "H"],
      ]);
      expect(lic.rows.every((r) => r.person_id !== null)).toBe(true);
      const ppl = await c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM lsbd.person WHERE legacy_key = ANY($1::int[])`,
        [[K1, K2]],
      );
      expect(ppl.rows[0].n).toBe(2);
      const pii = await c.query<{ ssn_hash: string | null }>(
        `SELECT pii.ssn_hash FROM lsbd.licensee_pii pii JOIN lsbd.person p ON p.id = pii.person_id WHERE p.legacy_key = $1`,
        [K1],
      );
      expect(pii.rows[0].ssn_hash).toBe("it-hash-1"); // SSN is already the HMAC in lsbd_raw

      await c.query(`UPDATE lsbd_raw."tblDenHyg" SET "LASTName" = 'CHARLIE' WHERE "Key" = $1`, [K1]);
      await run(c);
      const after = await c.query<{ last_name: string }>(
        `SELECT last_name FROM lsbd.person WHERE legacy_key = $1`,
        [K1],
      );
      expect(after.rows[0].last_name).toBe("CHARLIE");
      const n = await c.query<{ n: number }>(
        `SELECT (SELECT count(*) FROM lsbd.license WHERE license_id = $1)::int
              + (SELECT count(*) FROM lsbd.person WHERE legacy_key = ANY($2::int[]))::int AS n`,
        [LIC, [K1, K2]],
      );
      expect(n.rows[0].n).toBe(4);
    });
  }, T);

  it("(b) soft-deleted raw row removes its license and person; licensee_pii cascades", async () => {
    await inTx(async () => {
      await insertRaw(c, { Key: K1, LICENSEID: LIC, Type: "D", LASTName: "ALPHA", SSN: "it-hash-1" });
      await insertRaw(c, { Key: K2, LICENSEID: LIC, Type: "H", LASTName: "BRAVO" });
      await run(c);
      const pid = await c.query<{ id: number }>(`SELECT id FROM lsbd.person WHERE legacy_key = $1`, [K1]);
      expect(pid.rows).toHaveLength(1);

      await c.query(`UPDATE lsbd_raw."tblDenHyg" SET _deleted_at = now() WHERE "Key" = $1`, [K1]);
      await run(c);
      const gone = await c.query<{ lic: number; per: number; pii: number; other: number }>(
        `SELECT (SELECT count(*) FROM lsbd.license WHERE legacy_key = $1)::int AS lic,
                (SELECT count(*) FROM lsbd.person WHERE legacy_key = $1)::int AS per,
                (SELECT count(*) FROM lsbd.licensee_pii WHERE person_id = $2)::int AS pii,
                (SELECT count(*) FROM lsbd.license WHERE legacy_key = $3)::int AS other`,
        [K1, pid.rows[0].id, K2],
      );
      expect(gone.rows[0]).toEqual({ lic: 0, per: 0, pii: 0, other: 1 });
    });
  }, T);

  // Ruling R22 (spec 4.2 "App-facing IDs must stay stable"): the licensee path depends only
  // on the live tblDenHyg row. An unresolved Individual link is "unlinked", never excluded.
  it("(c) tblDenHyg row pointing at a nonexistent Individual is still inserted, with individual_id NULL", async () => {
    await inTx(async () => {
      await insertRaw(c, { Key: K3, LICENSEID: LIC, Type: "D", LASTName: "UNLINKED", IndividualID_: MISSING_INDIVIDUAL });
      await run(c);
      const r = await c.query<{ individual_id: string | null; lic: number }>(
        `SELECT p.individual_id, (SELECT count(*) FROM lsbd.license l WHERE l.legacy_key = $1 AND l.person_id = p.id)::int AS lic
           FROM lsbd.person p WHERE p.legacy_key = $1`,
        [K3],
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]).toEqual({ individual_id: null, lic: 1 });
    });
  }, T);

  it("(g) soft-deleting an Individual's IndividualStatus does not delete its persons or licenses", async () => {
    const STATUS_UUID = "a0000000-0000-4000-8000-000900000001";
    const INDV_UUID = "a0000000-0000-4000-8000-000900000002";
    await inTx(async () => {
      await c.query(
        `INSERT INTO lsbd_raw."IndividualStatus" ("IndividualStatus_ID", "IndividualStatusID", "Status", _row_hash)
         VALUES ($1, $2::uuid, 'IT-TEST', 'it-test')`,
        [K1, STATUS_UUID],
      );
      await c.query(
        `INSERT INTO lsbd_raw."Individual" ("INDVID", "IndividualID", "IndividualStatusID", "LastName", _row_hash)
         VALUES ($1, $2::uuid, $3::uuid, 'ALPHA', 'it-test')`,
        [K1, INDV_UUID, STATUS_UUID],
      );
      await insertRaw(c, { Key: K1, LICENSEID: LIC, Type: "D", LASTName: "ALPHA", IndividualID_: K1 });
      await insertRaw(c, { Key: K2, LICENSEID: LIC, Type: "H", LASTName: "ALPHA", IndividualID_: K1 });
      await run(c);
      const ids = `SELECT p.legacy_key, p.id AS person_id, l.id AS license_id, p.individual_id
                     FROM lsbd.person p JOIN lsbd.license l ON l.person_id = p.id
                    WHERE p.legacy_key = ANY($1::int[]) ORDER BY p.legacy_key`;
      const before = await c.query(ids, [[K1, K2]]);
      expect(before.rows).toHaveLength(2);
      expect(before.rows.every((r) => r.individual_id === INDV_UUID)).toBe(true);

      await c.query(`UPDATE lsbd_raw."IndividualStatus" SET _deleted_at = now() WHERE "IndividualStatus_ID" = $1`, [K1]);
      await run(c);
      const after = await c.query(ids, [[K1, K2]]);
      // Same person and license ids (not deleted + re-created).
      expect(after.rows.map((r) => [r.legacy_key, r.person_id, r.license_id])).toEqual(
        before.rows.map((r) => [r.legacy_key, r.person_id, r.license_id]),
      );
      // Task 14 "lookup, not gate": the Individual itself is no longer deleted with its
      // status (only its individual_status_uuid becomes NULL), so the person stays linked.
      expect(after.rows.every((r) => r.individual_id === INDV_UUID)).toBe(true);
      const ind = await c.query(`SELECT individual_status_uuid FROM lsbd.individual WHERE indv_id = $1`, [K1]);
      expect(ind.rows).toEqual([{ individual_status_uuid: null }]);
    });
  }, T);

  it("(h) a delete of >50% of a >100-row lsbd table raises and commits nothing; lsbd.allow_mass_delete overrides", async () => {
    const live = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM lsbd.schools`);
    expect(live.rows[0].n).toBeGreaterThan(100);

    await inTx(async () => {
      await c.query(`UPDATE lsbd_raw."tblSchools" SET _deleted_at = now() WHERE _deleted_at IS NULL`);
      await expect(run(c, ["tblSchools"])).rejects.toThrow(/mass delete blocked on lsbd\.schools: \d+ of \d+ rows/);
    });
    const still = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM lsbd.schools`);
    expect(still.rows[0].n).toBe(live.rows[0].n);

    await inTx(async () => {
      await c.query(`UPDATE lsbd_raw."tblSchools" SET _deleted_at = now() WHERE _deleted_at IS NULL`);
      await c.query(`SET LOCAL lsbd.allow_mass_delete = 'on'`);
      await run(c, ["tblSchools"]);
      const r = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM lsbd.schools`);
      expect(r.rows[0].n).toBe(0);
    });
    const restored = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM lsbd.schools`);
    expect(restored.rows[0].n).toBe(live.rows[0].n);
  }, T);

  it("(d) a second run with no source change updates no license rows (R5: pg_stat_xact_user_tables)", async () => {
    await inTx(async () => {
      await insertRaw(c, { Key: K1, LICENSEID: LIC, Type: "D", LASTName: "ALPHA" });
      await run(c);
      const before = await licenseStats(c);
      await run(c);
      const after = await licenseStats(c);
      expect(after.upd).toBe(before.upd);
      expect(after.ins).toBe(before.ins);
      expect(after.del).toBe(before.del);
    });
  }, T);

  it("(e) DateUntil 2027-12-31 00:00 (naive Central) lands as 2027-12-31 06:00 UTC", async () => {
    await inTx(async () => {
      await insertRaw(c, { Key: K1, LICENSEID: LIC, Type: "D", LASTName: "ALPHA", DateUntil: "2027-12-31 00:00:00" });
      await run(c);
      const r = await c.query<{ local_day: string; exact: boolean }>(
        `SELECT to_char((date_until AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM-DD') AS local_day,
                date_until = '2027-12-31 06:00:00+00'::timestamptz AS exact
           FROM lsbd.license WHERE legacy_key = $1`,
        [K1],
      );
      expect(r.rows[0]).toEqual({ local_day: "2027-12-31", exact: true });
    });
  }, T);

  it("(f) incremental: changed_sources = {Zipcodes} does not run transform_denhyg_pii", async () => {
    await inTx(async () => {
      await insertRaw(c, { Key: K1, LICENSEID: LIC, Type: "D", LASTName: "ALPHA" });
      const before = await licenseStats(c);
      await run(c, ["Zipcodes"]);
      const after = await licenseStats(c);
      expect(after.ins + after.upd + after.del).toBe(before.ins + before.upd + before.del);
      const r = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM lsbd.license WHERE legacy_key = $1`, [K1]);
      expect(r.rows[0].n).toBe(0); // the new raw row was not transformed
    });
  }, T);
});
