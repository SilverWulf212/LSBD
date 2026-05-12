// scripts/etl-b2-entities.ts
//
// B-2 entities: individual + professional + office + schools + lsbd.users +
// category + specialty + statutes + lsbd.board_members + announcements + faqs.
//
// Strategy:
//   - WIPE all target tables.
//   - Preserve source integer IDs where the Drizzle target uses `serial id`,
//     because B-3/B-4 cross-table FKs key off these.
//   - Resolve uuid FKs by passing the source uuid through (individual.status,
//     professional.individual_id) — these match by uuid value, not by int.
//   - Resolve category int FK for announcements + faqs via in-memory uuid→id
//     lookup after category load.
//   - After all INSERTs, reset SERIAL sequences to MAX(id)+1.
//
// Run:
//   $env:POSTGRES_URL = "<session pooler url>"
//   npx tsx scripts/etl-b2-entities.ts

import * as fs from "node:fs";
import * as readline from "node:readline";
import { Client } from "pg";

const DATA_DIR = process.env.LSBD_DATA_DIR ?? "D:/extracted/data";
const BATCH_SIZE = 500;

async function readJsonl<T = Record<string, unknown>>(file: string): Promise<T[]> {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  const rows: T[] = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line) as T);
  }
  return rows;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
function intOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function boolOrNull(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toUpperCase();
  if (s === "Y" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "FALSE" || s === "0") return false;
  return null;
}
function tsOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

async function batchInsert(
  client: Client,
  table: string,
  cols: string[],
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;
  const colCount = cols.length;
  for (let off = 0; off < rows.length; off += BATCH_SIZE) {
    const batch = rows.slice(off, off + BATCH_SIZE);
    const params: unknown[] = [];
    const placeholders: string[] = [];
    for (const row of batch) {
      const ph: string[] = [];
      for (let c = 0; c < colCount; c++) {
        params.push(row[c]);
        ph.push(`$${params.length}`);
      }
      placeholders.push(`(${ph.join(",")})`);
    }
    await client.query(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES ${placeholders.join(",")}`,
      params
    );
  }
}

async function resetSequence(client: Client, table: string, col: string = "id"): Promise<void> {
  // Bring the table's id_seq up to MAX(id) so new inserts don't collide.
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence($1, $2),
      COALESCE((SELECT MAX(${col}) FROM ${table}), 1),
      true
    )
  `, [table, col]);
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 600_000,
  });
  await client.connect();
  console.log("Connected.");

  // Wipe in FK-safe order (deepest first).
  console.log("WIPE: TRUNCATE B-2 target tables …");
  await client.query(`
    TRUNCATE TABLE
      lsbd.faqs,
      lsbd.announcements,
      lsbd.board_members,
      lsbd.statute_violations,
      lsbd.statutes,
      lsbd.specialty,
      lsbd.category,
      lsbd.users,
      lsbd.schools,
      lsbd.office,
      lsbd.professional,
      lsbd.individual,
      lsbd.individual_status
    RESTART IDENTITY CASCADE
  `);

  const totals: { tbl: string; n: number }[] = [];

  // ── individual_status ──────────────────────────────────────────────────────
  {
    type S = {
      IndividualStatus_ID: number;
      IndividualStatusID: string;
      Status: string | null;
      ProcessRenewal: boolean | null;
    };
    const src = await readJsonl<S>(`${DATA_DIR}/IndividualStatus.jsonl`);
    const rows = src.map((r) => [
      r.IndividualStatus_ID,
      strOrNull(r.IndividualStatusID),
      strOrNull(r.Status),
      boolOrNull(r.ProcessRenewal),
      r.IndividualStatus_ID,
    ]);
    await batchInsert(client, "lsbd.individual_status",
      ["id", "individual_status_uuid", "status", "process_renewal", "legacy_id"],
      rows);
    await resetSequence(client, "lsbd.individual_status");
    totals.push({ tbl: "individual_status", n: rows.length });
  }

  // ── individual ─────────────────────────────────────────────────────────────
  {
    type I = {
      IndividualID: string;
      LastName: string | null;
      FirstName: string | null;
      MiddleName: string | null;
      MarriedName: string | null;
      LicenseName: string | null;
      Suffix: string | null;
      Prefix: string | null;
      UseLicenseName: boolean | null;
      SSN: string | null;
      DOB: string | null;
      Sex: string | null;
      Race: string | null;
      Email: string | null;
      WebSite: string | null;
      ProcessingGroup: string | null;
      Notes: string | null;
      Updated: string | null;
      IndividualStatusID: string | null;
      ID: number | null;
      STATUS: string | null;
      INDVID: number;
    };
    const src = await readJsonl<I>(`${DATA_DIR}/Individual.jsonl`);
    const rows = src.map((r) => [
      r.IndividualID,
      strOrNull(r.LastName),
      strOrNull(r.FirstName),
      strOrNull(r.MiddleName),
      strOrNull(r.MarriedName),
      strOrNull(r.LicenseName),
      strOrNull(r.Suffix),
      strOrNull(r.Prefix),
      boolOrNull(r.UseLicenseName),
      strOrNull(r.SSN),
      tsOrNull(r.DOB),
      strOrNull(r.Sex),
      strOrNull(r.Race),
      strOrNull(r.Email),
      strOrNull(r.WebSite),
      strOrNull(r.ProcessingGroup),
      strOrNull(r.Notes),
      tsOrNull(r.Updated),
      strOrNull(r.IndividualStatusID),
      intOrNull(r.ID),
      strOrNull(r.STATUS),
      r.INDVID,
    ]);
    await batchInsert(client, "lsbd.individual",
      ["individual_id", "last_name", "first_name", "middle_name", "married_name",
       "license_name", "suffix", "prefix", "use_license_name", "ssn",
       "dob", "sex", "race", "email", "web_site",
       "processing_group", "notes", "updated_at", "individual_status_uuid",
       "legacy_id", "status", "indv_id"],
      rows);
    totals.push({ tbl: "individual", n: rows.length });
  }

  // Build individual_id uuid set so we can null orphan professional.individual_id refs.
  const individualUuidSet = new Set<string>();
  {
    const res = await client.query(`SELECT individual_id::text AS uid FROM lsbd.individual`);
    for (const r of res.rows) individualUuidSet.add(String(r.uid).toLowerCase());
  }

  // ── professional ───────────────────────────────────────────────────────────
  // Source column has typo `Creditial_Exam` — pass through to credential_exam.
  {
    type P = {
      ProfessionalID: string;
      ProfessionalTypeID: string | null;
      PracticeTypeID: string | null;
      IndividualID: string | null;
      LicenseNumber: string | null;
      Original_Lic_Issue_Date: string | null;
      Creditial_Exam: string | null;
      AuditYear: string | null;
      Updated: string | null;
      Inactive: boolean | null;
      CSNone: boolean | null;
      CSDispense: boolean | null;
      CSAdminister: boolean | null;
      Professional_ID: number;
      ProfessionalType: string | null;
      PracticeType: string | null;
      Individual_ID: string | null;
    };
    const src = await readJsonl<P>(`${DATA_DIR}/Professional.jsonl`);
    let orphans = 0;
    const rows = src.map((r) => {
      let indUid: string | null = strOrNull(r.IndividualID);
      if (indUid && !individualUuidSet.has(indUid.toLowerCase())) {
        orphans++;
        indUid = null; // null out broken FK
      }
      return [
      r.ProfessionalID,
      strOrNull(r.ProfessionalTypeID),
      strOrNull(r.PracticeTypeID),
      indUid,
      strOrNull(r.LicenseNumber),
      tsOrNull(r.Original_Lic_Issue_Date),
      strOrNull(r.Creditial_Exam),
      strOrNull(r.AuditYear),
      tsOrNull(r.Updated),
      boolOrNull(r.Inactive),
      boolOrNull(r.CSNone),
      boolOrNull(r.CSDispense),
      boolOrNull(r.CSAdminister),
      r.Professional_ID,
      strOrNull(r.ProfessionalType),
      strOrNull(r.PracticeType),
      strOrNull(r.Individual_ID),
    ];
    });
    if (orphans > 0) console.log(`  professional: ${orphans} orphan individual_id refs nulled.`);
    await batchInsert(client, "lsbd.professional",
      ["professional_id", "professional_type_uuid", "practice_type_uuid",
       "individual_id", "license_number", "original_lic_issue_date",
       "credential_exam", "audit_year", "updated_at", "inactive",
       "cs_none", "cs_dispense", "cs_administer", "legacy_id",
       "professional_type", "practice_type", "individual_legacy_id"],
      rows);
    totals.push({ tbl: "professional", n: rows.length });
  }

  // ── office ─────────────────────────────────────────────────────────────────
  {
    type O = {
      OFFICE_ID: number;
      OfficeID: string;
      OfficeName: string | null;
      Updated: string | null;
      OldOfficeID: number | null;
      Phone: string | null;
    };
    const src = await readJsonl<O>(`${DATA_DIR}/Office.jsonl`);
    const rows = src.map((r) => [
      r.OFFICE_ID,
      strOrNull(r.OfficeID),
      strOrNull(r.OfficeName),
      tsOrNull(r.Updated),
      intOrNull(r.OldOfficeID),
      strOrNull(r.Phone),
    ]);
    await batchInsert(client, "lsbd.office",
      ["id", "legacy_uid", "office_name", "updated", "old_office_id", "phone"],
      rows);
    await resetSequence(client, "lsbd.office");
    totals.push({ tbl: "office", n: rows.length });
  }

  // ── schools ────────────────────────────────────────────────────────────────
  {
    type S = { ID: number; SCHNAME: string | null; SCHSTATE: string | null };
    const src = await readJsonl<S>(`${DATA_DIR}/tblSchools.jsonl`);
    const rows = src.map((r) => [r.ID, strOrNull(r.SCHSTATE), strOrNull(r.SCHNAME)]);
    await batchInsert(client, "lsbd.schools",
      ["id", "sch_state", "sch_name"], rows);
    await resetSequence(client, "lsbd.schools");
    totals.push({ tbl: "schools", n: rows.length });
  }

  // ── lsbd.users (legacy LSBD app users — names only, no password) ──────────
  {
    type U = {
      User_ID: number;
      UserID: string;
      UserName: string | null;
      Password: string | null;        // intentionally not migrated
      AccessLevel: number | null;
      EmailAddress: string | null;
      FullName: string | null;
      SR_Col_1_Width: number | null;
      SR_Col_2_Width: number | null;
      Inspector: boolean | null;
      Title: string | null;
      Phone: string | null;
    };
    const src = await readJsonl<U>(`${DATA_DIR}/Users.jsonl`);
    const rows = src.map((r) => [
      r.User_ID,
      strOrNull(r.UserID),
      strOrNull(r.UserName),
      intOrNull(r.AccessLevel),
      strOrNull(r.EmailAddress),
      strOrNull(r.FullName),
      intOrNull(r.SR_Col_1_Width),
      intOrNull(r.SR_Col_2_Width),
      boolOrNull(r.Inspector),
      strOrNull(r.Title),
      strOrNull(r.Phone),
    ]);
    await batchInsert(client, "lsbd.users",
      ["id", "legacy_uid", "user_name", "access_level", "email_address",
       "full_name", "sr_col_1_width", "sr_col_2_width", "inspector", "title", "phone"],
      rows);
    await resetSequence(client, "lsbd.users");
    totals.push({ tbl: "users (lsbd)", n: rows.length });
  }

  // ── category ───────────────────────────────────────────────────────────────
  // Source name is Catagory (sic).
  {
    type C = {
      CATID: number;
      CAT_ID: string;
      CAT_DESC: string | null;
      CAT_ACTIVE: boolean | null;
      CAT_TYPE: number | null;
    };
    const src = await readJsonl<C>(`${DATA_DIR}/Catagory.jsonl`);
    const rows = src.map((r) => [
      r.CATID,
      strOrNull(r.CAT_ID),
      strOrNull(r.CAT_DESC),
      boolOrNull(r.CAT_ACTIVE),
      intOrNull(r.CAT_TYPE),
    ]);
    await batchInsert(client, "lsbd.category",
      ["id", "legacy_uid", "description", "active", "cat_type"], rows);
    await resetSequence(client, "lsbd.category");
    totals.push({ tbl: "category", n: rows.length });
  }

  // Build category uuid→id map for announcements + faqs FK resolution.
  const categoryMap = new Map<string, number>();
  {
    const res = await client.query(`SELECT id, legacy_uid::text AS uid FROM lsbd.category`);
    for (const r of res.rows) {
      if (r.uid) categoryMap.set(String(r.uid).toLowerCase(), r.id as number);
    }
  }

  // ── specialty (0 rows expected) ────────────────────────────────────────────
  {
    // 0 rows in source — nothing to load. Reset sequence anyway.
    await resetSequence(client, "lsbd.specialty");
    totals.push({ tbl: "specialty", n: 0 });
  }

  // ── statutes (0 rows expected) ─────────────────────────────────────────────
  {
    await resetSequence(client, "lsbd.statutes");
    totals.push({ tbl: "statutes", n: 0 });
  }

  // ── lsbd.board_members ─────────────────────────────────────────────────────
  {
    type B = {
      BoardMember_ID: number;
      BoardMemberID: string;
      FullName: string | null;
      Title: string | null;
      Address1: string | null;
      Address2: string | null;
      DisplayOrderOverride: number | null;
    };
    const src = await readJsonl<B>(`${DATA_DIR}/BoardMembers.jsonl`);
    const rows = src.map((r) => [
      r.BoardMember_ID,
      strOrNull(r.BoardMemberID),
      strOrNull(r.FullName),
      strOrNull(r.Title),
      strOrNull(r.Address1),
      strOrNull(r.Address2),
      intOrNull(r.DisplayOrderOverride),
    ]);
    await batchInsert(client, "lsbd.board_members",
      ["id", "legacy_uid", "full_name", "title", "address_1", "address_2",
       "display_order_override"], rows);
    await resetSequence(client, "lsbd.board_members");
    totals.push({ tbl: "board_members (lsbd)", n: rows.length });
  }

  // ── announcements ──────────────────────────────────────────────────────────
  {
    type A = {
      ANNOUNCID: number;
      ANNOUNC_ID: string;
      ANNOUNC_SUBJECT: string | null;
      ANNOUNC_ANNOUNCEMENTS: string | null;
      ANNOUNC_EXP_DATE: string | null;
      ANNOUNC_ACTIVE: boolean | null;
      CAT_ID: string | null;
      CATEGORY: string | null;
    };
    const src = await readJsonl<A>(`${DATA_DIR}/Announcements.jsonl`);
    const rows = src.map((r) => {
      const catId = r.CAT_ID ? categoryMap.get(r.CAT_ID.toLowerCase()) ?? null : null;
      return [
        r.ANNOUNCID,
        strOrNull(r.ANNOUNC_ID),
        strOrNull(r.ANNOUNC_SUBJECT),
        strOrNull(r.ANNOUNC_ANNOUNCEMENTS),
        tsOrNull(r.ANNOUNC_EXP_DATE),
        boolOrNull(r.ANNOUNC_ACTIVE),
        strOrNull(r.CAT_ID),
        catId,
        strOrNull(r.CATEGORY),
      ];
    });
    await batchInsert(client, "lsbd.announcements",
      ["id", "legacy_uid", "subject", "body", "expiration_date", "active",
       "category_uid", "category_id", "category_text"], rows);
    await resetSequence(client, "lsbd.announcements");
    totals.push({ tbl: "announcements", n: rows.length });
  }

  // ── faqs ───────────────────────────────────────────────────────────────────
  {
    type F = {
      FAQSID: number;
      FAQS_ID: string;
      FAQS_QUESTIONS: string | null;
      FAQS_ANSWERS: string | null;
      FAQS_ACTIVE: boolean | null;
      CAT_ID: string | null;
      CATEGORY: string | null;
    };
    const src = await readJsonl<F>(`${DATA_DIR}/FAQS.jsonl`);
    const rows = src.map((r) => {
      const catId = r.CAT_ID ? categoryMap.get(r.CAT_ID.toLowerCase()) ?? null : null;
      return [
        r.FAQSID,
        strOrNull(r.FAQS_ID),
        strOrNull(r.FAQS_QUESTIONS),
        strOrNull(r.FAQS_ANSWERS),
        boolOrNull(r.FAQS_ACTIVE),
        strOrNull(r.CAT_ID),
        catId,
        strOrNull(r.CATEGORY),
      ];
    });
    await batchInsert(client, "lsbd.faqs",
      ["id", "legacy_uid", "question", "answer", "active",
       "category_uid", "category_id", "category_text"], rows);
    await resetSequence(client, "lsbd.faqs");
    totals.push({ tbl: "faqs", n: rows.length });
  }

  console.log("\nLoaded row counts:");
  for (const t of totals) console.log(`  ${t.tbl}: ${t.n}`);
  console.log(`Total: ${totals.reduce((a, b) => a + b.n, 0)} rows across ${totals.length} tables.`);

  // Spot-check FK resolution
  const proIndCheck = await client.query(`
    SELECT count(*)::int AS n
    FROM lsbd.professional p
    LEFT JOIN lsbd.individual i ON p.individual_id = i.individual_id
    WHERE p.individual_id IS NOT NULL AND i.individual_id IS NULL
  `);
  console.log(`\nFK check: professional rows with unresolved individual_id (uuid): ${proIndCheck.rows[0].n}`);

  const annCheck = await client.query(`
    SELECT count(*)::int AS resolved FROM lsbd.announcements WHERE category_id IS NOT NULL
  `);
  console.log(`Announcements with category_id resolved: ${annCheck.rows[0].resolved}/5`);
  const faqCheck = await client.query(`
    SELECT count(*)::int AS resolved FROM lsbd.faqs WHERE category_id IS NOT NULL
  `);
  console.log(`FAQs with category_id resolved: ${faqCheck.rows[0].resolved}/21`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
