// scripts/etl-b1b-lookups.ts
//
// B-1b: Load domain lookup tables into lsbd schema. Each is small (≤37 rows).
// Pattern: TRUNCATE + INSERT, all in one transactional script.
//
// Run:
//   $env:POSTGRES_URL = "<session pooler url>"
//   npx tsx scripts/etl-b1b-lookups.ts

import * as fs from "node:fs";
import * as readline from "node:readline";
import { Client } from "pg";

const DATA_DIR = process.env.LSBD_DATA_DIR ?? "D:/extracted/data";

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
function strOrEmpty(v: unknown): string {
  return strOrNull(v) ?? "";
}
function boolOr(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v == null) return fallback;
  const s = String(v).trim().toUpperCase();
  if (s === "Y" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "FALSE" || s === "0") return false;
  return fallback;
}
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function decOrNull(v: unknown): string | null {
  // numeric/decimal columns: pass as string to preserve precision.
  if (v == null || v === "") return null;
  return String(v);
}

async function bulkInsert(
  client: Client,
  table: string,
  cols: string[],
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;
  const params: unknown[] = [];
  const placeholders: string[] = [];
  for (const row of rows) {
    const ph: string[] = [];
    for (const v of row) {
      params.push(v);
      ph.push(`$${params.length}`);
    }
    placeholders.push(`(${ph.join(",")})`);
  }
  await client.query(
    `INSERT INTO ${table} (${cols.join(",")}) VALUES ${placeholders.join(",")}`,
    params
  );
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
  });
  await client.connect();
  console.log("Connected.");

  // WIPE first. Order matters only for FK-bearing tables (none here).
  const wipeTargets = [
    "lsbd.address_type_lookup",
    "lsbd.tbl_types",
    "lsbd.tbl_status",
    "lsbd.tbl_class",
    "lsbd.tbl_inactive_status",
    "lsbd.tbl_specialties",
    "lsbd.tbl_prin_set",
    "lsbd.tbl_form_empl",
    "lsbd.tbl_report_type",
    "lsbd.professional_type",
    "lsbd.practice_type",
    "lsbd.sed_level",
    "lsbd.compl_action",
    "lsbd.compl_closure",
    "lsbd.compl_decision",
    "lsbd.compl_hearing",
    "lsbd.compl_probation",
    "lsbd.compl_status",
    "lsbd.disposition",
    "lsbd.education_type",
    "lsbd.permit_type",
    "lsbd.trans_type",
    "lsbd.charge_category",
    "lsbd.charge_int",
  ];
  console.log(`WIPE: TRUNCATE ${wipeTargets.length} lookup tables …`);
  await client.query(`TRUNCATE TABLE ${wipeTargets.join(", ")} RESTART IDENTITY CASCADE`);

  const totals: { tbl: string; n: number }[] = [];

  // ── address_type_lookup ────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ AddressTypeID: string; AddressType: string }>(
      `${DATA_DIR}/AddressType.jsonl`
    );
    const rows = src.map((r) => [strOrNull(r.AddressTypeID), strOrEmpty(r.AddressType)]);
    await bulkInsert(client, "lsbd.address_type_lookup", ["legacy_uid", "address_type"], rows);
    totals.push({ tbl: "address_type_lookup", n: rows.length });
  }

  // ── tbl_types ──────────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Type: string; TypeDesc: string }>(`${DATA_DIR}/tblTypes.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Type), strOrNull(r.TypeDesc)]);
    await bulkInsert(client, "lsbd.tbl_types", ["type", "type_desc"], rows);
    totals.push({ tbl: "tbl_types", n: rows.length });
  }

  // ── tbl_status ─────────────────────────────────────────────────────────────
  {
    type S = { StatusId: string; Status: string; LoginOk: boolean | null; RenewOk: boolean | null };
    const src = await readJsonl<S>(`${DATA_DIR}/tblStatus.jsonl`);
    const rows = src.map((r) => [
      strOrEmpty(r.StatusId),
      strOrNull(r.Status),
      boolOr(r.LoginOk, false),
      boolOr(r.RenewOk, false),
    ]);
    await bulkInsert(client, "lsbd.tbl_status", ["status_id", "status", "login_ok", "renew_ok"], rows);
    totals.push({ tbl: "tbl_status", n: rows.length });
  }

  // ── tbl_class ──────────────────────────────────────────────────────────────
  {
    type C = { Class: string; ClassDesc: string; LoginOk: boolean | null; RenewOk: boolean | null };
    const src = await readJsonl<C>(`${DATA_DIR}/tblClass.jsonl`);
    const rows = src.map((r) => [
      strOrEmpty(r.Class),
      strOrNull(r.ClassDesc),
      boolOr(r.LoginOk, false),
      boolOr(r.RenewOk, false),
    ]);
    await bulkInsert(client, "lsbd.tbl_class", ["class", "class_desc", "login_ok", "renew_ok"], rows);
    totals.push({ tbl: "tbl_class", n: rows.length });
  }

  // ── tbl_inactive_status ────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Status: string }>(`${DATA_DIR}/tblnactiveStatus.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Status)]);
    await bulkInsert(client, "lsbd.tbl_inactive_status", ["status"], rows);
    totals.push({ tbl: "tbl_inactive_status", n: rows.length });
  }

  // ── tbl_specialties ────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Specialty: string }>(`${DATA_DIR}/tblSpecialties.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Specialty)]);
    await bulkInsert(client, "lsbd.tbl_specialties", ["specialty"], rows);
    totals.push({ tbl: "tbl_specialties", n: rows.length });
  }

  // ── tbl_prin_set ───────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ PrinSet: string }>(`${DATA_DIR}/tblPrinSet.jsonl`);
    const rows = src.map((r) => [strOrNull(r.PrinSet)]);
    await bulkInsert(client, "lsbd.tbl_prin_set", ["prin_set"], rows);
    totals.push({ tbl: "tbl_prin_set", n: rows.length });
  }

  // ── tbl_form_empl ──────────────────────────────────────────────────────────
  // Source PK is the text "ID" (e.g. "03"); Drizzle keeps it as text primary key.
  {
    const src = await readJsonl<{ ID: string; FormEmploy: string }>(`${DATA_DIR}/tblFormEmpl.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.ID), strOrNull(r.FormEmploy)]);
    await bulkInsert(client, "lsbd.tbl_form_empl", ["id", "form_employ"], rows);
    totals.push({ tbl: "tbl_form_empl", n: rows.length });
  }

  // ── tbl_report_type ────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ ReportType: string }>(`${DATA_DIR}/tblReportType.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.ReportType)]);
    await bulkInsert(client, "lsbd.tbl_report_type", ["report_type"], rows);
    totals.push({ tbl: "tbl_report_type", n: rows.length });
  }

  // ── professional_type ──────────────────────────────────────────────────────
  {
    type P = {
      ProfessionalTypeID: string;
      ProfessionalType: string;
      LICSCode: string | null;
      RenewalFee: number | null;
      LateFee: number | null;
      FirstTimeFee: number | null;
    };
    const src = await readJsonl<P>(`${DATA_DIR}/ProfessionalType.jsonl`);
    const rows = src.map((r) => [
      strOrNull(r.ProfessionalTypeID),
      strOrNull(r.ProfessionalType),
      strOrNull(r.LICSCode),
      decOrNull(r.RenewalFee),
      decOrNull(r.LateFee),
      decOrNull(r.FirstTimeFee),
    ]);
    await bulkInsert(
      client,
      "lsbd.professional_type",
      ["legacy_uid", "professional_type", "lics_code", "renewal_fee", "late_fee", "first_time_fee"],
      rows
    );
    totals.push({ tbl: "professional_type", n: rows.length });
  }

  // ── practice_type ──────────────────────────────────────────────────────────
  {
    type P = { PracticeTypeID: string; PracticeType: string | null; Specialty: boolean | null };
    const src = await readJsonl<P>(`${DATA_DIR}/PracticeType.jsonl`);
    const rows = src.map((r) => [
      strOrNull(r.PracticeTypeID),
      strOrNull(r.PracticeType),
      r.Specialty == null ? null : boolOr(r.Specialty, false),
    ]);
    await bulkInsert(client, "lsbd.practice_type", ["legacy_uid", "practice_type", "specialty"], rows);
    totals.push({ tbl: "practice_type", n: rows.length });
  }

  // ── sed_level ──────────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ SLEVEL: string; DESCRIPTION: string }>(`${DATA_DIR}/tblSedLevels.jsonl`);
    const rows = src.map((r) => [strOrNull(r.SLEVEL), strOrNull(r.DESCRIPTION)]);
    await bulkInsert(client, "lsbd.sed_level", ["s_level", "description"], rows);
    totals.push({ tbl: "sed_level", n: rows.length });
  }

  // ── compl_action ───────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Action: string; Desc: string }>(`${DATA_DIR}/tblComplActions.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Action), strOrNull(r.Desc)]);
    await bulkInsert(client, "lsbd.compl_action", ["action", "description"], rows);
    totals.push({ tbl: "compl_action", n: rows.length });
  }

  // ── compl_closure ──────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Closure: string; Desc: string }>(`${DATA_DIR}/tblComplClosure.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Closure), strOrNull(r.Desc)]);
    await bulkInsert(client, "lsbd.compl_closure", ["closure", "description"], rows);
    totals.push({ tbl: "compl_closure", n: rows.length });
  }

  // ── compl_decision ─────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Decision: string; Desc: string }>(`${DATA_DIR}/tblComplDecisions.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Decision), strOrNull(r.Desc)]);
    await bulkInsert(client, "lsbd.compl_decision", ["decision", "description"], rows);
    totals.push({ tbl: "compl_decision", n: rows.length });
  }

  // ── compl_hearing ──────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Hearing: string; Desc: string }>(`${DATA_DIR}/tblComplHearings.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Hearing), strOrNull(r.Desc)]);
    await bulkInsert(client, "lsbd.compl_hearing", ["hearing", "description"], rows);
    totals.push({ tbl: "compl_hearing", n: rows.length });
  }

  // ── compl_probation ────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Probation: string; Desc: string }>(`${DATA_DIR}/tblComplProbation.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Probation), strOrNull(r.Desc)]);
    await bulkInsert(client, "lsbd.compl_probation", ["probation", "description"], rows);
    totals.push({ tbl: "compl_probation", n: rows.length });
  }

  // ── compl_status ───────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Status: string; Description: string }>(`${DATA_DIR}/tblComplStatus.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Status), strOrNull(r.Description)]);
    await bulkInsert(client, "lsbd.compl_status", ["code", "description"], rows);
    totals.push({ tbl: "compl_status", n: rows.length });
  }

  // ── disposition ────────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ Disposition: string; Description: string }>(`${DATA_DIR}/tblDisposition.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.Disposition), strOrNull(r.Description)]);
    await bulkInsert(client, "lsbd.disposition", ["code", "description"], rows);
    totals.push({ tbl: "disposition", n: rows.length });
  }

  // ── education_type ─────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ EducationType: string }>(`${DATA_DIR}/EducationType.jsonl`);
    const rows = src.map((r) => [strOrNull(r.EducationType)]);
    await bulkInsert(client, "lsbd.education_type", ["education_type"], rows);
    totals.push({ tbl: "education_type", n: rows.length });
  }

  // ── permit_type ────────────────────────────────────────────────────────────
  {
    type P = {
      PermitType: string;
      Description: string;
      PersonalFee: number | null;
      OfficeFee: number | null;
      PersonalPriority: number | null;
    };
    const src = await readJsonl<P>(`${DATA_DIR}/PermitType.jsonl`);
    const rows = src.map((r) => [
      strOrNull(r.PermitType),
      strOrNull(r.Description),
      decOrNull(r.PersonalFee),
      decOrNull(r.OfficeFee),
      numOrNull(r.PersonalPriority),
    ]);
    await bulkInsert(
      client,
      "lsbd.permit_type",
      ["permit_type", "description", "personal_fee", "office_fee", "personal_priority"],
      rows
    );
    totals.push({ tbl: "permit_type", n: rows.length });
  }

  // ── trans_type ─────────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ TransType: string }>(`${DATA_DIR}/tblTransTypes.jsonl`);
    const rows = src.map((r) => [strOrEmpty(r.TransType)]);
    await bulkInsert(client, "lsbd.trans_type", ["trans_type"], rows);
    totals.push({ tbl: "trans_type", n: rows.length });
  }

  // ── charge_category ────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ CHARGE_CAT: string; DESCRIPT: string }>(`${DATA_DIR}/tblChargeCategory.jsonl`);
    const rows = src.map((r) => [strOrNull(r.CHARGE_CAT), strOrNull(r.DESCRIPT)]);
    await bulkInsert(client, "lsbd.charge_category", ["charge_cat", "description"], rows);
    totals.push({ tbl: "charge_category", n: rows.length });
  }

  // ── charge_int ─────────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ INT_CHRG: string; DESCRIPT: string }>(`${DATA_DIR}/tblChargeInt.jsonl`);
    const rows = src.map((r) => [strOrNull(r.INT_CHRG), strOrNull(r.DESCRIPT)]);
    await bulkInsert(client, "lsbd.charge_int", ["int_charge", "description"], rows);
    totals.push({ tbl: "charge_int", n: rows.length });
  }

  console.log("\nLoaded row counts (per table):");
  for (const t of totals) console.log(`  ${t.tbl}: ${t.n}`);
  console.log(`Total: ${totals.reduce((a, b) => a + b.n, 0)} rows across ${totals.length} tables.`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
