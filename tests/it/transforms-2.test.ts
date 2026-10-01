import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { loadSecrets } from "../../scripts/lib/secrets";
import { connectPg } from "../../scripts/lib/pg";
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
    c = await connectPg(url, { applicationName: "lsbd-it" });
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

  // R26/R28: OfficeAffiliation -> Office is a nullable LOOKUP. A row pointing at a missing
  // office loads with office_id NULL and is counted 'unlinked', never skipped.
  it("(a1) an OfficeAffiliation row pointing at a nonexistent office loads with office_id NULL (unlinked)", async () => {
    await inTx(async () => {
      const office = await count(c, `SELECT min("OFFICE_ID") FROM lsbd_raw."Office" WHERE _deleted_at IS NULL`);
      const base = await run(c, ["OfficeAffiliation"]);
      // Real dangling rows (OFFICE_ID with no live Office) before the synthetic one: whatever the
      // live data holds today (R34/M4: no assumption that there are any).
      const danglingSql = `SELECT count(*) FROM lsbd_raw."OfficeAffiliation" r
          WHERE r._deleted_at IS NULL AND r."OFFICE_ID" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM lsbd_raw."Office" o WHERE o._deleted_at IS NULL AND o."OFFICE_ID" = r."OFFICE_ID")`;
      const danglingBefore = await count(c, danglingSql);
      await c.query(
        `INSERT INTO lsbd_raw."OfficeAffiliation" ("OfficeAffiliation_ID", "OFFICE_ID", "DENTIST_ID", "OfficePermit", _row_hash)
         VALUES ($1, $2, 1, false, 'it-test'), ($3, $4, 1, true, 'it-test')`,
        [K1, MISSING, K2, office],
      );
      const orphans = await run(c, ["OfficeAffiliation"]);
      expect(orphans).toBe(base); // nothing skipped: the dangling row is loaded, not dropped
      const rows = await c.query(
        `SELECT id, office_id, office_permit FROM lsbd.office_affiliation WHERE id = ANY($1::int[]) ORDER BY id`,
        [[K1, K2]],
      );
      expect(rows.rows).toEqual([
        { id: K1, office_id: null, office_permit: false },
        { id: K2, office_id: office, office_permit: true },
      ]);
      // Every dangling row (the synthetic one plus any real "1,926-style" ones) is loaded with
      // office_id NULL.
      const dangling = await count(c, danglingSql);
      expect(dangling).toBe(danglingBefore + 1);
      expect(
        await count(
          c,
          `SELECT count(*) FROM lsbd.office_affiliation t
             JOIN lsbd_raw."OfficeAffiliation" r ON r."OfficeAffiliation_ID" = t.id AND r._deleted_at IS NULL
            WHERE r."OFFICE_ID" IS NOT NULL AND t.office_id IS NULL`,
        ),
      ).toBe(dangling);
      expect(
        await count(c, `SELECT count(*) FROM lsbd_raw."OfficeAffiliation" WHERE _deleted_at IS NULL`),
      ).toBe(await count(c, `SELECT count(*) FROM lsbd.office_affiliation`));
      const q = await c.query<{ kind: string; n: string }>(
        `SELECT kind, n FROM lsbd._transform_quality
          WHERE target = 'lsbd.office_affiliation' AND relation IN ('office_id -> office', 'skipped (orphan / unkeyable / duplicate)')
          ORDER BY kind`,
      );
      expect(q.rows.map((r) => [r.kind, Number(r.n)])).toEqual([
        ["skipped", 0],
        ["unlinked", dangling],
      ]);
    });
  }, T);

  // The skip (orphan) path keeps IT coverage through a row that cannot be loaded: lsbd.logins
  // needs a non-empty license_id, and the source row has LicenseID = ''.
  it("(a2) an unloadable source row is an orphan: counted, not inserted", async () => {
    await inTx(async () => {
      const base = await run(c, ["Logins"]);
      await c.query(
        `INSERT INTO lsbd_raw."Logins" ("ID", "LicenseID", "LicType", "LoginDate", _row_hash)
         VALUES ($1, '', 'D', '2026-09-30 10:00', 'it-test'), ($2, 'IT-1', 'D', '2026-09-30 10:00', 'it-test')`,
        [K1, K2],
      );
      const orphans = await run(c, ["Logins"]);
      expect(orphans).toBeGreaterThanOrEqual(1);
      expect(orphans).toBe(base + 1);
      expect(await count(c, `SELECT count(*) FROM lsbd.logins WHERE id = $1`, [K1])).toBe(0);
      expect(await count(c, `SELECT count(*) FROM lsbd.logins WHERE id = $1`, [K2])).toBe(1);
      const q = await c.query<{ n: string; source_table: string }>(
        `SELECT n, source_table FROM lsbd._transform_quality WHERE target = 'lsbd.logins' AND kind = 'skipped'`,
      );
      expect(q.rows).toHaveLength(1);
      expect(q.rows[0].source_table).toBe("Logins");
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

  // R29: the SSN HMAC lives only in lsbd.licensee_pii; the random_sample tables never carry it.
  it("(g) random_sample_dentists / _hygienists.ssn is never populated, even when the raw row has an SSN", async () => {
    await inTx(async () => {
      await c.query(
        `INSERT INTO lsbd_raw."tblRndDentists" ("Key", "LICENSEID", "SSN", _row_hash) VALUES ($1, 'IT-1', 'it-hash-d', 'it-test')`,
        [K1],
      );
      await c.query(
        `INSERT INTO lsbd_raw."tblRndHygienists" ("Key", "LICENSEID", "SSN", _row_hash) VALUES ($1, 'IT-1', 'it-hash-h', 'it-test')`,
        [K1],
      );
      await run(c, ["tblRndDentists", "tblRndHygienists"]);
      expect(await count(c, `SELECT count(*) FROM lsbd.random_sample_dentists WHERE id = $1`, [K1])).toBe(1);
      expect(await count(c, `SELECT count(*) FROM lsbd.random_sample_hygienists WHERE id = $1`, [K1])).toBe(1);
      expect(
        await count(
          c,
          `SELECT (SELECT count(*) FROM lsbd.random_sample_dentists WHERE ssn IS NOT NULL)
                + (SELECT count(*) FROM lsbd.random_sample_hygienists WHERE ssn IS NOT NULL)`,
        ),
      ).toBe(0);
    });
  }, T);

  // R30: specialty -> professional and announcements / faqs -> category are lookups: a row whose
  // parent is missing loads with the reference NULL (source uuid kept in the *_uid column).
  it("(h) specialty / announcements / faqs with a missing parent load with the reference NULL", async () => {
    const MISSING_UUID = "a0000000-0000-4000-8000-000999999999";
    const SPEC_UUID = "a0000000-0000-4000-8000-000900000021";
    const unlinked = async (): Promise<Record<string, number>> => {
      const q = await c.query<{ target: string; n: string }>(
        `SELECT target, n FROM lsbd._transform_quality
          WHERE kind = 'unlinked' AND target IN ('lsbd.announcements', 'lsbd.faqs', 'lsbd.specialty')`,
      );
      const out: Record<string, number> = { "lsbd.announcements": 0, "lsbd.faqs": 0, "lsbd.specialty": 0 };
      for (const x of q.rows) out[x.target] = Number(x.n);
      return out;
    };
    await inTx(async () => {
      // Baseline from the live data (R34/M4: real orphans may exist; only the delta is asserted).
      await run(c, ["Announcements", "FAQS", "Specialty"]);
      const before = await unlinked();
      await c.query(
        `INSERT INTO lsbd_raw."Announcements" ("ANNOUNCID", "ANNOUNC_SUBJECT", "CAT_ID", _row_hash) VALUES ($1, 'IT', $2::uuid, 'it-test')`,
        [K1, MISSING_UUID],
      );
      await c.query(
        `INSERT INTO lsbd_raw."FAQS" ("FAQSID", "FAQS_QUESTIONS", "CAT_ID", _row_hash) VALUES ($1, 'IT', $2::uuid, 'it-test')`,
        [K1, MISSING_UUID],
      );
      await c.query(
        `INSERT INTO lsbd_raw."Specialty" ("SpecialtyID", "ProfessionalD", "Institution", _row_hash) VALUES ($1::uuid, $2::uuid, 'IT', 'it-test')`,
        [SPEC_UUID, MISSING_UUID],
      );
      await run(c, ["Announcements", "FAQS", "Specialty"]);
      const r = await c.query(
        `SELECT (SELECT row(category_id, category_uid::text)::text FROM lsbd.announcements WHERE id = $1) AS ann,
                (SELECT row(category_id, category_uid::text)::text FROM lsbd.faqs WHERE id = $1) AS faq,
                (SELECT row(professional_id, professional_uid::text)::text FROM lsbd.specialty WHERE legacy_id = $2) AS spec`,
        [K1, SPEC_UUID],
      );
      expect(r.rows[0]).toEqual({ ann: `(,${MISSING_UUID})`, faq: `(,${MISSING_UUID})`, spec: `(,${MISSING_UUID})` });
      expect(await unlinked()).toEqual({
        "lsbd.announcements": before["lsbd.announcements"] + 1,
        "lsbd.faqs": before["lsbd.faqs"] + 1,
        "lsbd.specialty": before["lsbd.specialty"] + 1,
      });
    });
  }, T);

  // R33/M5: ElectionDistricts -> Parishes is a nullable LOOKUP (it was a gate that dropped the
  // row). A row pointing at a missing parish loads with parish_id NULL and is counted 'unlinked'.
  it("(i) an ElectionDistricts row with a nonexistent ParishID loads with parish_id NULL (unlinked)", async () => {
    const MISSING_UUID = "a0000000-0000-4000-8000-000999999998";
    const unlinked = async (): Promise<number> =>
      count(
        c,
        `SELECT coalesce((SELECT n FROM lsbd._transform_quality
                           WHERE target = 'lsbd.election_districts' AND relation = 'parish_id -> parishes' AND kind = 'unlinked'), 0)`,
      );
    await inTx(async () => {
      const base = await run(c, ["ElectionDistricts"]);
      const before = await unlinked();
      const parish = await c.query<{ uid: string }>(
        `SELECT "ParishID"::text AS uid FROM lsbd_raw."Parishes" WHERE _deleted_at IS NULL AND "ParishID" IS NOT NULL ORDER BY "Parish_ID" LIMIT 1`,
      );
      await c.query(
        `INSERT INTO lsbd_raw."ElectionDistricts" ("ElectionDistrict_ID", "ParishID", "District", "PARISH", _row_hash)
         VALUES ($1, $2::uuid, 1, 'IT', 'it-test'), ($3, $4::uuid, 2, 'IT', 'it-test')`,
        [K1, MISSING_UUID, K2, parish.rows[0]?.uid ?? null],
      );
      const orphans = await run(c, ["ElectionDistricts"]);
      expect(orphans).toBe(base); // the dangling row is loaded, not skipped
      const rows = await c.query<{ legacy_id: string; linked: boolean }>(
        `SELECT legacy_id, parish_id IS NOT NULL AS linked FROM lsbd.election_districts
          WHERE legacy_id = ANY($1::text[]) ORDER BY legacy_id`,
        [[String(K1), String(K2)]],
      );
      expect(rows.rows).toEqual([
        { legacy_id: String(K1), linked: false },
        { legacy_id: String(K2), linked: parish.rows.length > 0 },
      ]);
      expect(await unlinked()).toBe(before + 1);
      expect(await count(c, `SELECT count(*) FROM lsbd_raw."ElectionDistricts" WHERE _deleted_at IS NULL`)).toBe(
        await count(c, `SELECT count(*) FROM lsbd.election_districts`),
      );
    });
  }, T);
});
