// scripts/etl-tbldenhyg.ts
//
// First-pass ETL: read the JSONL dump of MSSQL dbo.tblDenHyg and split each row
// into lsbd.person + lsbd.license rows in Supabase.
//
// PII (SSN, DOB, SEX, RACE, password) is deliberately NOT loaded yet — it
// belongs in lsbd.licensee_pii with hashing/RLS, which we'll do as a second
// pass once Erin signs off on the data-handling approach.
//
// Run:
//   npx tsx scripts/etl-tbldenhyg.ts
//
// Env required: POSTGRES_URL (Supabase session pooler URL).
//   Override path/wipe with env vars below.

import * as fs from "node:fs";
import * as readline from "node:readline";
import { Client } from "pg";

const JSONL_PATH = process.env.LSBD_JSONL ?? "D:/extracted/data/tblDenHyg.jsonl";
const WIPE = process.env.LSBD_WIPE !== "false"; // default true on first load
const BATCH_SIZE = 200;

// Enum allow-lists from the schema. Anything outside these gets NULL'd to
// avoid blowing up the load on a single bad row.
const TYPE_VALUES = new Set(["D", "H", "E", "O"]);
const STATUS_VALUES = new Set([
  "ACT", "SUS", "REV", "REP", "ARC", "PRB",
  "DEC", "EXP", "OTH", "TMP", "INA", "RET", "VOL",
]);
const CLASS_VALUES = new Set(["L", "A", "I", "P", "T", "O", "C", "V", "NL"]);

function enumOrNull<T extends string>(v: unknown, allow: Set<T>): T | null {
  if (v == null) return null;
  const s = String(v).trim();
  return allow.has(s as T) ? (s as T) : null;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length === 0 ? null : s;
}

function tsOrNull(v: unknown): string | null {
  // SqlClient JSON serialization gave us ISO 8601 strings already
  if (v == null) return null;
  const s = String(v);
  return s.length === 0 ? null : s;
}

function boolOrNull(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toUpperCase();
  if (s === "Y" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "FALSE" || s === "0") return false;
  return null;
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL to the Supabase session pooler URL.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
  });
  await client.connect();
  console.log("Connected to Postgres:", (await client.query("SELECT current_database(), version()")).rows[0]);

  if (WIPE) {
    console.log("WIPE: TRUNCATE lsbd.license, lsbd.person …");
    await client.query("TRUNCATE TABLE lsbd.license, lsbd.person RESTART IDENTITY CASCADE");
  }

  const total = await new Promise<number>((res) => {
    let n = 0;
    fs.createReadStream(JSONL_PATH).on("data", (chunk) => {
      n += (chunk as Buffer).toString().split("\n").length - 1;
    }).on("end", () => res(n));
  });
  console.log(`Source: ${JSONL_PATH} (${total} rows expected)`);

  const rl = readline.createInterface({
    input: fs.createReadStream(JSONL_PATH),
    crlfDelay: Infinity,
  });

  const personValues: any[] = [];
  const licenseValues: any[] = [];
  let processed = 0;
  let skippedBadType = 0;

  async function flush() {
    if (personValues.length === 0) return;
    const rows = personValues.length / 17;

    // Insert all person rows in one statement, returning ids in order.
    const personParams: any[] = [];
    const personPlaceholders: string[] = [];
    for (let r = 0; r < rows; r++) {
      const start = r * 17;
      const ph = [];
      for (let c = 0; c < 17; c++) {
        personParams.push(personValues[start + c]);
        ph.push(`$${personParams.length}`);
      }
      personPlaceholders.push(`(${ph.join(",")})`);
    }
    const personRes = await client.query(
      `INSERT INTO lsbd.person (
         first_name, middle_name, last_name, license_name, married_name,
         prefix, suffix, use_license_name, email, url,
         phone1, ext1, phone2, ext2, fax, fax2, opt_in
       ) VALUES ${personPlaceholders.join(",")} RETURNING id`,
      personParams
    );
    const personIds = personRes.rows.map((r) => r.id as number);

    // Now insert license rows with the matching person_id
    const licenseParams: any[] = [];
    const licensePlaceholders: string[] = [];
    const colCount = 21; // license cols per row, NOT counting person_id
    for (let r = 0; r < rows; r++) {
      const start = r * colCount;
      const personId = personIds[r];
      const ph = [`$${licenseParams.length + 1}`];
      licenseParams.push(personId);
      for (let c = 0; c < colCount; c++) {
        licenseParams.push(licenseValues[start + c]);
        ph.push(`$${licenseParams.length}`);
      }
      licensePlaceholders.push(`(${ph.join(",")})`);
    }
    await client.query(
      `INSERT INTO lsbd.license (
         person_id,
         legacy_key, license_id, type, class, status,
         date_since, date_inactive, date_reinstate, date_renew, date_until,
         reg_year, renew_month,
         pa_number, pllc_number, permit_number,
         processing_group, is_current, audit, action, audit_year, credential_exam
       ) VALUES ${licensePlaceholders.join(",")}
       ON CONFLICT (license_id) DO NOTHING`,
      licenseParams
    );

    personValues.length = 0;
    licenseValues.length = 0;
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);

    const type = enumOrNull(row.Type, TYPE_VALUES);
    if (row.Type != null && type === null) skippedBadType++;

    // person values (17 cols, order matches INSERT above)
    personValues.push(
      strOrNull(row.FIRSTName),
      strOrNull(row.MIDDLE),
      strOrNull(row.LASTName),
      strOrNull(row.LicenseName),
      strOrNull(row.MarriedName),
      strOrNull(row.Prefix),
      strOrNull(row.Suffix),
      boolOrNull(row.UseLicenseName) ?? false,
      strOrNull(row.Email),
      strOrNull(row.URL),
      strOrNull(row.Phone1),
      strOrNull(row.Ext1),
      strOrNull(row.Phone2),
      strOrNull(row.Ext2),
      strOrNull(row.Fax),
      strOrNull(row.Fax2),
      strOrNull(row.OPT_IN)
    );

    // license values (22 cols, order matches INSERT above EXCEPT person_id which we prepend per row in flush())
    licenseValues.push(
      typeof row.Key === "number" ? row.Key : null,
      strOrNull(row.LICENSEID) ?? `unknown-${row.Key ?? processed}`,
      type,
      enumOrNull(row.Class, CLASS_VALUES),
      enumOrNull(row.STATUS, STATUS_VALUES),
      tsOrNull(row.DateSince),
      tsOrNull(row.DateInactive),
      tsOrNull(row.DateReinstate),
      tsOrNull(row.DateRenew),
      tsOrNull(row.DateUntil),
      strOrNull(row.RegYear),
      strOrNull(row.RenewMnth),
      strOrNull(row.PANO),
      strOrNull(row.PLLCNO),
      strOrNull(row.PERMITNO),
      strOrNull(row.ProcessingGroup),
      boolOrNull(row.IsCurrent) ?? true,
      strOrNull(row.Audit),
      strOrNull(row.Action),
      strOrNull(row.AuditYear),
      strOrNull(row.Credential_Exam)
    );

    processed++;
    if (processed % BATCH_SIZE === 0) {
      await flush();
      if (processed % 2000 === 0) console.log(`  ${processed}/${total} rows…`);
    }
  }
  await flush();

  console.log(`Done. Processed ${processed} rows. Skipped-bad-type: ${skippedBadType}.`);

  const counts = await client.query(`
    SELECT 'lsbd.person' AS tbl, count(*)::int AS n FROM lsbd.person
    UNION ALL SELECT 'lsbd.license', count(*)::int FROM lsbd.license
  `);
  for (const r of counts.rows) console.log(`  ${r.tbl}: ${r.n} rows`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
