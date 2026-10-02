// scripts/etl-b4.ts
//
// B-4: complaints, discipline, audit, exams.
//
// Tables loaded:
//   - complaint (5295)
//   - disciplinary (643)
//   - logins (96,218 — full load, no archival; tiny enough for now)
//   - dent_exam (347)
//   - hyg_exam (360)
//
// Random sampling tables (random_sample_dentists 295 rows, _hygienists 238)
// have 100 source columns each; the Drizzle target mirrors source. They're
// nice-to-have for historical CE audits but not load-bearing for any
// near-term feature. DEFERRED — load later when needed.
//
// Run:
//   $env:POSTGRES_URL = "<session pooler url>"
//   npx tsx scripts/etl-b4.ts

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  readJsonl, batchInsert, streamLoad, resetSequence,
  strOrNull, intOrNull, boolOrNull, tsOrNull, decOrNull, floatOrNull,
} from "./lib/etl-helpers";
import { scriptPgConfig } from "./lib/pg";

const DATA_DIR = process.env.LSBD_DATA_DIR ?? "D:/extracted/data";

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL.");
    process.exit(1);
  }

  const client = new Client({
    ...scriptPgConfig(process.env.POSTGRES_URL),
    statement_timeout: 600_000,
  });
  await client.connect();
  console.log("Connected.");

  console.log("WIPE: TRUNCATE B-4 target tables …");
  await client.query(`
    TRUNCATE TABLE
      lsbd.hyg_exam,
      lsbd.dent_exam,
      lsbd.logins,
      lsbd.disciplinary,
      lsbd.complaint
    RESTART IDENTITY CASCADE
  `);

  const totals: { tbl: string; n: number }[] = [];

  // ── complaint ────────────────────────────────────────────────────────────
  {
    type C = {
      Key: number;
      LICENSEID: string | null;
      LOG_NO: string | null;
      LOG_DT: string | null;
      CLOSE_DT: string | null;
      DECIS_DT: string | null;
      LAST_VISIT: string | null;
      OPEN: string | null;
      STATUS: string | null;
      INT_CHRG1: string | null; INT_CHRG2: string | null; INT_CHRG3: string | null;
      CHRGE_CAT1: string | null; CHRGE_CAT2: string | null; CHRGE_CAT3: string | null;
      CHARGE1: string | null; CHARGE2: string | null; CHARGE3: string | null;
      BOARDMEMBR: string | null;
      INVESTIGTR: string | null;
      COMPLNANT: string | null;
      HEARING: string | null;
      DEC_TYPE: string | null;
      ACTION: string | null;
      SUSP_PRD: string | null; SUSP_BEGIN: string | null; SUSP_END: string | null;
      PROB_PRD: string | null; PROB_BEGIN: string | null; PROB_END: string | null;
      CE_COURSES: string | null;
      CE_AREA1: string | null; CE_HOURS1: number | null;
      CE_AREA2: string | null; CE_HOURS2: number | null;
      COUNSELING: string | null;
      COMMENTS: string | null;
      ATT_NAME: string | null; ATT_FIRM: string | null;
      ATT_STR1: string | null; ATT_STR2: string | null;
      ATT_CITY: string | null; ATT_STATE: string | null; ATT_ZIP: string | null;
      ATT_PHONE: string | null;
      att_ext: string | null;
      ClosureTerms: string | null;
      ProbTerms: string | null;
      Address1C: string | null; Address2C: string | null;
      CITYC: string | null; STATEC: string | null; ZIPC: string | null; COUNTYC: string | null;
      PhoneC: string | null; ExtC: string | null;
      FaxC: string | null;
      LICTYPE: string | null;
    };
    const src = await readJsonl<C>(`${DATA_DIR}/tblComplaints.jsonl`);
    const rows = src.map((r) => [
      r.Key,
      strOrNull(r.LICENSEID),
      strOrNull(r.LOG_NO),
      tsOrNull(r.LOG_DT),
      tsOrNull(r.CLOSE_DT),
      tsOrNull(r.DECIS_DT),
      tsOrNull(r.LAST_VISIT),
      strOrNull(r.OPEN),
      strOrNull(r.STATUS),
      strOrNull(r.INT_CHRG1), strOrNull(r.INT_CHRG2), strOrNull(r.INT_CHRG3),
      strOrNull(r.CHRGE_CAT1), strOrNull(r.CHRGE_CAT2), strOrNull(r.CHRGE_CAT3),
      strOrNull(r.CHARGE1), strOrNull(r.CHARGE2), strOrNull(r.CHARGE3),
      strOrNull(r.BOARDMEMBR),
      strOrNull(r.INVESTIGTR),
      strOrNull(r.COMPLNANT),
      strOrNull(r.HEARING),
      strOrNull(r.DEC_TYPE),
      strOrNull(r.ACTION),
      strOrNull(r.SUSP_PRD), tsOrNull(r.SUSP_BEGIN), tsOrNull(r.SUSP_END),
      strOrNull(r.PROB_PRD), tsOrNull(r.PROB_BEGIN), tsOrNull(r.PROB_END),
      strOrNull(r.CE_COURSES),
      strOrNull(r.CE_AREA1), floatOrNull(r.CE_HOURS1),
      strOrNull(r.CE_AREA2), floatOrNull(r.CE_HOURS2),
      strOrNull(r.COUNSELING),
      strOrNull(r.COMMENTS),
      strOrNull(r.ATT_NAME), strOrNull(r.ATT_FIRM),
      strOrNull(r.ATT_STR1), strOrNull(r.ATT_STR2),
      strOrNull(r.ATT_CITY), strOrNull(r.ATT_STATE), strOrNull(r.ATT_ZIP),
      strOrNull(r.ATT_PHONE),
      strOrNull(r.att_ext),
      strOrNull(r.ClosureTerms),
      strOrNull(r.ProbTerms),
      strOrNull(r.Address1C), strOrNull(r.Address2C),
      strOrNull(r.CITYC), strOrNull(r.STATEC), strOrNull(r.ZIPC), strOrNull(r.COUNTYC),
      strOrNull(r.PhoneC), strOrNull(r.ExtC), strOrNull(r.FaxC),
      strOrNull(r.LICTYPE),
    ]);
    await batchInsert(client, "lsbd.complaint",
      ["legacy_key", "license_id", "log_no", "log_date", "close_date",
       "decision_date", "last_visit", "open", "status",
       "int_charge1", "int_charge2", "int_charge3",
       "charge_cat1", "charge_cat2", "charge_cat3",
       "charge1", "charge2", "charge3",
       "board_member", "investigator", "complainant",
       "hearing", "decision_type", "action",
       "susp_period", "susp_begin", "susp_end",
       "prob_period", "prob_begin", "prob_end",
       "ce_courses", "ce_area1", "ce_hours1", "ce_area2", "ce_hours2",
       "counseling", "comments",
       "attorney_name", "attorney_firm",
       "attorney_street1", "attorney_street2",
       "attorney_city", "attorney_state", "attorney_zip",
       "attorney_phone", "attorney_ext",
       "closure_terms", "probation_terms",
       "complainant_address1", "complainant_address2",
       "complainant_city", "complainant_state", "complainant_zip",
       "complainant_county",
       "complainant_phone", "complainant_ext", "complainant_fax",
       "license_type"], rows);
    totals.push({ tbl: "complaint", n: rows.length });
  }

  // ── disciplinary ─────────────────────────────────────────────────────────
  // Build individual uuid set so we can null orphan individual_id refs.
  const individualUuidSet = new Set<string>();
  {
    const res = await client.query(`SELECT individual_id::text AS uid FROM lsbd.individual`);
    for (const r of res.rows) individualUuidSet.add(String(r.uid).toLowerCase());
  }
  {
    type D = {
      Disciplinary_ID: number;
      DisciplinaryID: string;
      IndividualID: string | null;
      Individual_ID: number | null;
      StartDate: string | null;
      EndDate: string | null;
      Notes: string | null;
      GoodStanding: boolean | null;
      Updated: string | null;
      UpdatedBy: string | null;
    };
    const src = await readJsonl<D>(`${DATA_DIR}/Disciplinary.jsonl`);
    let orphans = 0;
    let generatedIds = 0;
    const rows = src.map((r) => {
      let indUid: string | null = strOrNull(r.IndividualID);
      if (indUid && !individualUuidSet.has(indUid.toLowerCase())) { orphans++; indUid = null; }
      let discId: string = strOrNull(r.DisciplinaryID) ?? "";
      if (!discId) { discId = randomUUID(); generatedIds++; }
      return [
        discId,
        indUid,
        tsOrNull(r.StartDate),
        tsOrNull(r.EndDate),
        strOrNull(r.Notes),
        tsOrNull(r.Updated),
        boolOrNull(r.GoodStanding),
        strOrNull(r.UpdatedBy),
        intOrNull(r.Individual_ID),
        r.Disciplinary_ID,
      ];
    });
    if (orphans > 0) console.log(`  disciplinary: ${orphans} orphan individual_id refs nulled.`);
    if (generatedIds > 0) console.log(`  disciplinary: ${generatedIds} synthetic UUIDs generated for null DisciplinaryID source rows.`);
    await batchInsert(client, "lsbd.disciplinary",
      ["disciplinary_id", "individual_id", "start_date", "end_date",
       "notes", "updated_at", "good_standing", "updated_by",
       "individual_legacy_id", "legacy_id"], rows);
    totals.push({ tbl: "disciplinary", n: rows.length });
  }

  // ── logins ───────────────────────────────────────────────────────────────
  // 96k rows. Schema requires license_id NOT NULL and login_date NOT NULL.
  // Stream-process.
  {
    type L = {
      ID: number;
      LicenseID: string | null;
      LicType: string | null;
      LoginDate: string | null;
    };
    let skipped = 0;
    const loaded = await streamLoad<L>(
      client,
      `${DATA_DIR}/Logins.jsonl`,
      "lsbd.logins",
      ["id", "license_id", "lic_type", "login_date"],
      (r) => {
        if (!r.LicenseID || !r.LoginDate || !r.LicType) { skipped++; return null; }
        return [r.ID, r.LicenseID, r.LicType, r.LoginDate];
      },
      { batchSize: 2000, onProgress: (n) => { if (n % 20000 === 0) console.log(`    logins: ${n}`); } }
    );
    await resetSequence(client, "lsbd.logins");
    if (skipped > 0) console.log(`    logins: ${skipped} rows skipped (null required field)`);
    totals.push({ tbl: "logins", n: loaded });
  }

  // ── dent_exam ────────────────────────────────────────────────────────────
  {
    type DE = {
      Key1: number;
      LicenseId: string | null;
      PrepAmal: number | null; RestAmal: number | null;
      PrepComp: number | null; RestComp: number | null;
      Endo: number | null; AvgLab: number | null;
      Pros: number | null; Perio: number | null;
      Written: number | null; Juris: number | null;
      Sterile: number | null; GRADE: number | null;
      Remarks: string | null;
      NatBoardScores: boolean | null;
      DenHygSchoolTrans: boolean | null;
      OtherTrans: boolean | null;
      Photos: boolean | null;
      ExamFee: boolean | null;
      RecoLetters: boolean | null;
      RegisLetter: boolean | null;
      CompleteAppl: boolean | null;
      LicensureCert: boolean | null;
      InsuranceVerify: boolean | null;
      DataBankRpt: boolean | null;
      TIMESTAMP: string | null;
    };
    const src = await readJsonl<DE>(`${DATA_DIR}/tblExamsDent.jsonl`);
    const rows = src.map((r) => [
      r.Key1,
      strOrNull(r.LicenseId),
      decOrNull(r.PrepAmal), decOrNull(r.RestAmal),
      decOrNull(r.PrepComp), decOrNull(r.RestComp),
      decOrNull(r.Endo), decOrNull(r.AvgLab),
      decOrNull(r.Pros), decOrNull(r.Perio),
      decOrNull(r.Written), decOrNull(r.Juris),
      decOrNull(r.Sterile), decOrNull(r.GRADE),
      strOrNull(r.Remarks),
      boolOrNull(r.NatBoardScores) ?? false,
      boolOrNull(r.DenHygSchoolTrans) ?? false,
      boolOrNull(r.OtherTrans) ?? false,
      boolOrNull(r.Photos) ?? false,
      boolOrNull(r.ExamFee) ?? false,
      boolOrNull(r.RecoLetters) ?? false,
      boolOrNull(r.RegisLetter) ?? false,
      boolOrNull(r.CompleteAppl) ?? false,
      boolOrNull(r.LicensureCert) ?? false,
      boolOrNull(r.InsuranceVerify) ?? false,
      boolOrNull(r.DataBankRpt) ?? false,
      tsOrNull(r.TIMESTAMP),
    ]);
    await batchInsert(client, "lsbd.dent_exam",
      ["legacy_key", "license_id",
       "prep_amal", "rest_amal", "prep_comp", "rest_comp",
       "endo", "avg_lab", "pros", "perio",
       "written", "juris", "sterile", "grade", "remarks",
       "nat_board_scores", "den_hyg_school_trans", "other_trans",
       "photos", "exam_fee", "reco_letters", "regis_letter",
       "complete_appl", "licensure_cert", "insurance_verify", "data_bank_rpt",
       "recorded_at"], rows);
    totals.push({ tbl: "dent_exam", n: rows.length });
  }

  // ── hyg_exam ─────────────────────────────────────────────────────────────
  {
    type HE = {
      Key1: number;
      LicenseId: string | null;
      Clinical: string | null;
      Juris: string | null; Sterile: string | null;
      Juris2: string | null; Sterile2: string | null;
      PassFail: string | null;
      Remarks: string | null;
      NatBoardScores: boolean | null;
      DenHygSchoolTrans: boolean | null;
      OtherTrans: boolean | null;
      Photos: boolean | null;
      ExamFee: boolean | null;
      RecoLetters: boolean | null;
      RegisLetter: boolean | null;
      CompleteAppl: boolean | null;
      LicensureCert: boolean | null;
      InsuranceVerify: boolean | null;
      TIMESTAMP: string | null;
    };
    const src = await readJsonl<HE>(`${DATA_DIR}/tblExamsHyg.jsonl`);
    const rows = src.map((r) => [
      r.Key1,
      strOrNull(r.LicenseId),
      strOrNull(r.Clinical),
      strOrNull(r.Juris), strOrNull(r.Sterile),
      strOrNull(r.Juris2), strOrNull(r.Sterile2),
      strOrNull(r.PassFail),
      strOrNull(r.Remarks),
      boolOrNull(r.NatBoardScores) ?? false,
      boolOrNull(r.DenHygSchoolTrans) ?? false,
      boolOrNull(r.OtherTrans) ?? false,
      boolOrNull(r.Photos) ?? false,
      boolOrNull(r.ExamFee) ?? false,
      boolOrNull(r.RecoLetters) ?? false,
      boolOrNull(r.RegisLetter) ?? false,
      boolOrNull(r.CompleteAppl) ?? false,
      boolOrNull(r.LicensureCert) ?? false,
      boolOrNull(r.InsuranceVerify) ?? false,
      tsOrNull(r.TIMESTAMP),
    ]);
    await batchInsert(client, "lsbd.hyg_exam",
      ["legacy_key", "license_id",
       "clinical", "juris", "sterile", "juris2", "sterile2",
       "pass_fail", "remarks",
       "nat_board_scores", "den_hyg_school_trans", "other_trans",
       "photos", "exam_fee", "reco_letters", "regis_letter",
       "complete_appl", "licensure_cert", "insurance_verify",
       "recorded_at"], rows);
    totals.push({ tbl: "hyg_exam", n: rows.length });
  }

  console.log("\nLoaded:");
  for (const t of totals) console.log(`  ${t.tbl}: ${t.n}`);
  console.log(`Total: ${totals.reduce((a, b) => a + b.n, 0)} rows across ${totals.length} tables.`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
