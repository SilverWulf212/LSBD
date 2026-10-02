// scripts/etl-b3.ts
//
// B-3: Relationships + operational + financial tables.
// 19 source tables, ~370k rows.
//
// Load order (FK-safe):
//   1. inspection_status → inspections → inspection_details
//   2. permits
//   3. education
//   4. renewals → renewal_details (needs permits) → transactions →
//      transaction_splits
//   5. renewal_certification
//   6. ADDRESS, address_history, individual_affiliation, office_affiliation,
//      office_aff_history, association_history, professional_llc,
//      vs_auth, vs_capture
//
// Run:
//   $env:POSTGRES_URL = "<session pooler url>"
//   npx tsx scripts/etl-b3.ts

import { Client } from "pg";
import {
  readJsonl, batchInsert, streamLoad, resetSequence,
  strOrNull, intOrNull, boolOrNull, tsOrNull, decOrNull, floatOrNull, lcOrNull,
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

  // WIPE in FK-safe order (deepest first).
  console.log("WIPE: TRUNCATE B-3 target tables …");
  await client.query(`
    TRUNCATE TABLE
      lsbd.transaction_splits,
      lsbd.transactions,
      lsbd.renewal_details,
      lsbd.renewal_certification,
      lsbd.renewals,
      lsbd.education,
      lsbd.permit_history,
      lsbd.permits,
      lsbd.inspection_details,
      lsbd.inspections,
      lsbd.inspection_status,
      lsbd.vs_capture,
      lsbd.vs_auth,
      lsbd.professional_llc,
      lsbd.association_history,
      lsbd.office_aff_history,
      lsbd.office_affiliation,
      lsbd.individual_affiliation,
      lsbd.address_history,
      lsbd.address
    RESTART IDENTITY CASCADE
  `);

  const totals: { tbl: string; n: number }[] = [];

  // ── inspection_status ─────────────────────────────────────────────────────
  {
    type S = {
      InspectionStatus_ID: number;
      InspectionStatusID: string;
      InspectionStatus: string | null;
    };
    const src = await readJsonl<S>(`${DATA_DIR}/InspectionStatus.jsonl`);
    const rows = src.map((r) => [r.InspectionStatus_ID, strOrNull(r.InspectionStatus)]);
    // Note: inspection_status table has only (id, inspection_status) — no legacy_uid column.
    await batchInsert(client, "lsbd.inspection_status",
      ["id", "inspection_status"], rows);
    await resetSequence(client, "lsbd.inspection_status");
    totals.push({ tbl: "inspection_status", n: rows.length });
  }

  // Build inspection_status uuid → id map (for inspections.inspection_status_id FK).
  // Match source InspectionStatusID uuid to target row by source InspectionStatus_ID.
  const inspectionStatusMap = new Map<string, number>();
  {
    const src = await readJsonl<{ InspectionStatus_ID: number; InspectionStatusID: string }>(
      `${DATA_DIR}/InspectionStatus.jsonl`
    );
    for (const s of src) {
      if (s.InspectionStatusID) inspectionStatusMap.set(s.InspectionStatusID.toLowerCase(), s.InspectionStatus_ID);
    }
  }

  // ── inspections ───────────────────────────────────────────────────────────
  {
    type I = {
      INSPECTID: number;
      OFFICE_ID: number | null;
      OfficeID: string | null;
      InspectionDate: string | null;
      InspectionNote: string | null;
      Score: number | null;
      D_1: string | null;
      D_1_List: string | null;
      D_1_Notes: string | null;
      D_2: string | null;
      E_1: string | null;
      E_1_Notes: string | null;
      InspectorID: number | null;
      InspectionStatusID: string | null;
      Address1: string | null;
      Address2: string | null;
      Address3: string | null;
      City: string | null;
      State: string | null;
      PostalCode: string | null;
      C_1_List: string | null;
      C_1_Notes: string | null;
      C_2: string | null;
      C_3: string | null;
      C_4: string | null;
      E_2: string | null;
      E_2_List: string | null;
      E_2_Notes: string | null;
      Phone: string | null;
      Violations: string | null;
      STATUS: string | null;
      Inspector: string | null;
    };
    const src = await readJsonl<I>(`${DATA_DIR}/Inspections.jsonl`);
    const rows = src.map((r) => [
      r.INSPECTID,
      intOrNull(r.OFFICE_ID),
      tsOrNull(r.InspectionDate),
      strOrNull(r.InspectionNote),
      intOrNull(r.Score),
      strOrNull(r.D_1), strOrNull(r.D_1_List), strOrNull(r.D_1_Notes),
      strOrNull(r.D_2),
      strOrNull(r.E_1), strOrNull(r.E_1_Notes),
      intOrNull(r.InspectorID),
      r.InspectionStatusID ? (inspectionStatusMap.get(r.InspectionStatusID.toLowerCase()) ?? null) : null,
      strOrNull(r.Address1), strOrNull(r.Address2), strOrNull(r.Address3),
      strOrNull(r.City), strOrNull(r.State), strOrNull(r.PostalCode),
      strOrNull(r.C_1_List), strOrNull(r.C_1_Notes),
      strOrNull(r.C_2), strOrNull(r.C_3), strOrNull(r.C_4),
      strOrNull(r.E_2), strOrNull(r.E_2_List), strOrNull(r.E_2_Notes),
      strOrNull(r.Phone), strOrNull(r.Violations),
      strOrNull(r.STATUS), strOrNull(r.Inspector),
    ]);
    await batchInsert(client, "lsbd.inspections",
      ["id", "office_id", "inspection_date", "inspection_note", "score",
       "d1", "d1_list", "d1_notes", "d2", "e1", "e1_notes",
       "inspector_id", "inspection_status_id",
       "address1", "address2", "address3", "city", "state", "postal_code",
       "c1_list", "c1_notes", "c2", "c3", "c4",
       "e2", "e2_list", "e2_notes", "phone", "violations", "status", "inspector"],
      rows);
    await resetSequence(client, "lsbd.inspections");
    totals.push({ tbl: "inspections", n: rows.length });
  }

  // Build inspections uuid → id map (for inspection_details.inspection_id).
  const inspectionsMap = new Map<string, number>();
  {
    const src = await readJsonl<{ INSPECTID: number; InspectionID: string }>(
      `${DATA_DIR}/Inspections.jsonl`
    );
    for (const s of src) {
      if (s.InspectionID) inspectionsMap.set(s.InspectionID.toLowerCase(), s.INSPECTID);
    }
  }

  // ── inspection_details ────────────────────────────────────────────────────
  {
    type D = {
      InspectionDetail_ID: number;
      InspectionID: string;
      INDVID: number | null;
      LastName: string | null;
      FirstName: string | null;
      MiddleName: string | null;
      MarriedName: string | null;
      LicenseName: string | null;
      Suffix: string | null;
      Prefix: string | null;
      Role: string | null;
      A_1: boolean | null; A_2: boolean | null; A_3: boolean | null;
      A_4: boolean | null; A_5: boolean | null; A_6: boolean | null;
      A_7: boolean | null; A_8: boolean | null; A_9: boolean | null;
    };
    const src = await readJsonl<D>(`${DATA_DIR}/InspectionDetails.jsonl`);
    const rows = src.map((r) => [
      r.InspectionDetail_ID,
      r.InspectionID ? (inspectionsMap.get(r.InspectionID.toLowerCase()) ?? null) : null,
      intOrNull(r.INDVID),
      strOrNull(r.LastName), strOrNull(r.FirstName), strOrNull(r.MiddleName),
      strOrNull(r.MarriedName), strOrNull(r.LicenseName),
      strOrNull(r.Suffix), strOrNull(r.Prefix), strOrNull(r.Role),
      boolOrNull(r.A_1), boolOrNull(r.A_2), boolOrNull(r.A_3),
      boolOrNull(r.A_4), boolOrNull(r.A_5), boolOrNull(r.A_6),
      boolOrNull(r.A_7), boolOrNull(r.A_8), boolOrNull(r.A_9),
    ]);
    await batchInsert(client, "lsbd.inspection_details",
      ["id", "inspection_id", "individual_id",
       "last_name", "first_name", "middle_name", "married_name", "license_name",
       "suffix", "prefix", "role",
       "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"],
      rows);
    await resetSequence(client, "lsbd.inspection_details");
    totals.push({ tbl: "inspection_details", n: rows.length });
  }

  // ── permits ───────────────────────────────────────────────────────────────
  // FK: permit_type_id (uuid → int). We trust B-1b loaded PermitType in source order,
  // so source PermitType_ID == target permit_type.id. Verify and build map.
  const permitTypeMap = new Map<string, number>();
  {
    const src = await readJsonl<{ PermitType_ID: number; PermitTypeID: string; PermitType: string | null }>(
      `${DATA_DIR}/PermitType.jsonl`
    );
    for (const s of src) {
      if (s.PermitTypeID) permitTypeMap.set(s.PermitTypeID.toLowerCase(), s.PermitType_ID);
    }
  }
  {
    type P = {
      Permits_ID: number;
      PermitTypeID: string | null;
      Dentist_ID: number | null;
      Office_ID: number | null;
      PermitType: string | null;
      PermitLevel: string | null;
      Description: string | null;
      IssueDate: string | null;
      Updated: string | null;
      UpdatedOnline: string | null;
    };
    const src = await readJsonl<P>(`${DATA_DIR}/Permits.jsonl`);
    const rows = src.map((r) => [
      r.Permits_ID,
      r.PermitTypeID ? (permitTypeMap.get(r.PermitTypeID.toLowerCase()) ?? null) : null,
      intOrNull(r.Dentist_ID),
      intOrNull(r.Office_ID),
      strOrNull(r.PermitType),
      strOrNull(r.PermitLevel),
      strOrNull(r.Description),
      tsOrNull(r.IssueDate),
      tsOrNull(r.Updated),
      tsOrNull(r.UpdatedOnline),
    ]);
    await batchInsert(client, "lsbd.permits",
      ["id", "permit_type_id", "dentist_id", "office_id",
       "permit_type_name", "permit_level", "description",
       "issue_date", "updated", "updated_online"],
      rows);
    await resetSequence(client, "lsbd.permits");
    totals.push({ tbl: "permits", n: rows.length });
  }

  // Build permits uuid → id map (for renewal_details.permit_id).
  const permitsMap = new Map<string, number>();
  {
    const src = await readJsonl<{ Permits_ID: number; PermitsID: string }>(
      `${DATA_DIR}/Permits.jsonl`
    );
    for (const s of src) {
      if (s.PermitsID) permitsMap.set(s.PermitsID.toLowerCase(), s.Permits_ID);
    }
  }

  // ── education ─────────────────────────────────────────────────────────────
  // FKs: education_type_id (uuid → int, trust order), school_state_id (uuid → int)
  const educationTypeMap = new Map<string, number>();
  {
    const src = await readJsonl<{ EducationType_ID: number; EducationTypeID: string }>(
      `${DATA_DIR}/EducationType.jsonl`
    );
    for (const s of src) {
      if (s.EducationTypeID) educationTypeMap.set(s.EducationTypeID.toLowerCase(), s.EducationType_ID);
    }
  }
  // Build states uuid → id map (for school_state_id).
  const statesMap = new Map<string, number>();
  {
    const res = await client.query(`SELECT id, legacy_uid::text AS uid FROM lsbd.states`);
    for (const r of res.rows) if (r.uid) statesMap.set(String(r.uid).toLowerCase(), r.id as number);
  }
  {
    type E = {
      Education_ID: number;
      Individual_ID: number | string | null;
      ProfessionalID: string | null;
      Professional_ID: number | null;
      DenHygID: number | null;
      EducationTypeID: string | null;
      School: string | null;
      GraduationDate: string | null;
      Updated: string | null;
      SchoolStateID: string | null;
      BoardCertified: boolean | null;
      CertifiedBy: string | null;
      CertificationDate: string | null;
      STATE: string | null;
      EDUTYPE: string | null;
    };
    const src = await readJsonl<E>(`${DATA_DIR}/Education.jsonl`);
    const rows = src.map((r) => [
      r.Education_ID,
      intOrNull(r.Professional_ID),
      intOrNull(r.Individual_ID),
      intOrNull(r.DenHygID),
      r.EducationTypeID ? (educationTypeMap.get(r.EducationTypeID.toLowerCase()) ?? null) : null,
      strOrNull(r.School),
      tsOrNull(r.GraduationDate),
      tsOrNull(r.Updated),
      r.SchoolStateID ? (statesMap.get(r.SchoolStateID.toLowerCase()) ?? null) : null,
      boolOrNull(r.BoardCertified),
      strOrNull(r.CertifiedBy),
      tsOrNull(r.CertificationDate),
      strOrNull(r.STATE),
      strOrNull(r.EDUTYPE),
    ]);
    await batchInsert(client, "lsbd.education",
      ["id", "professional_id", "individual_id", "den_hyg_id", "education_type_id",
       "school", "graduation_date", "updated", "school_state_id",
       "board_certified", "certified_by", "certification_date", "state", "edu_type"],
      rows);
    await resetSequence(client, "lsbd.education");
    totals.push({ tbl: "education", n: rows.length });
  }

  // ── renewals ──────────────────────────────────────────────────────────────
  {
    type R = {
      Renewal_ID: number;
      Individual_ID: number | null;
      IndividualID: string | null;
      AppPrinted: string | null;
      LicensePrinted: string | null;
      RenewalAmount: number | null;
      RenewalYear: string | null;
      TransactionDate: string | null;
      LastUpdate: string | null;
      AmountPaid: number | null;
      pPermitPrinted: string | null;
      oPermitPrinted: string | null;
    };
    const src = await readJsonl<R>(`${DATA_DIR}/Renewals.jsonl`);
    const rows = src.map((r) => [
      r.Renewal_ID,
      intOrNull(r.Individual_ID),
      tsOrNull(r.AppPrinted),
      tsOrNull(r.LicensePrinted),
      decOrNull(r.RenewalAmount),
      strOrNull(r.RenewalYear),
      tsOrNull(r.TransactionDate),
      tsOrNull(r.LastUpdate),
      decOrNull(r.AmountPaid),
      tsOrNull(r.pPermitPrinted),
      tsOrNull(r.oPermitPrinted),
    ]);
    await batchInsert(client, "lsbd.renewals",
      ["id", "individual_id", "app_printed", "license_printed",
       "renewal_amount", "renewal_year", "transaction_date", "last_update",
       "amount_paid", "p_permit_printed", "o_permit_printed"],
      rows);
    await resetSequence(client, "lsbd.renewals");
    totals.push({ tbl: "renewals", n: rows.length });
  }

  // Build renewals uuid → id map (for renewal_details.renewal_id and transactions.renewal_id).
  const renewalsMap = new Map<string, number>();
  {
    const src = await readJsonl<{ Renewal_ID: number; RenewalID: string }>(
      `${DATA_DIR}/Renewals.jsonl`
    );
    for (const s of src) {
      if (s.RenewalID) renewalsMap.set(s.RenewalID.toLowerCase(), s.Renewal_ID);
    }
  }

  // ── renewal_details ───────────────────────────────────────────────────────
  // Note: Drizzle schema has `renewal_id` and `permit_id` as FKs.
  {
    type RD = {
      RenewalDetail_ID: number;
      RenewalID: string | null;
      Renewal_ID: number | null;
      PermitID: string | null;
      Permit_ID: number | null;
      Printed: string | null;
    };
    const src = await readJsonl<RD>(`${DATA_DIR}/RenewalDetails.jsonl`);
    const rows = src.map((r) => [
      r.RenewalDetail_ID,
      r.RenewalID ? (renewalsMap.get(r.RenewalID.toLowerCase()) ?? null) : intOrNull(r.Renewal_ID),
      r.PermitID ? (permitsMap.get(r.PermitID.toLowerCase()) ?? null) : intOrNull(r.Permit_ID),
      tsOrNull(r.Printed),
    ]);
    await batchInsert(client, "lsbd.renewal_details",
      ["id", "renewal_id", "permit_id", "printed"], rows);
    await resetSequence(client, "lsbd.renewal_details");
    totals.push({ tbl: "renewal_details", n: rows.length });
  }

  // ── renewal_certification ─────────────────────────────────────────────────
  {
    type RC = {
      ID: number;
      DenHygID: number;
      Year: number;
      AnesIncident: string | null;
      Convicted: string | null;
      Discipline: string | null;
      CE: string | null;
    };
    const src = await readJsonl<RC>(`${DATA_DIR}/RenewalCertification.jsonl`);
    const rows = src.map((r) => [
      r.ID, r.DenHygID, r.Year,
      strOrNull(r.AnesIncident), strOrNull(r.Convicted),
      strOrNull(r.Discipline), strOrNull(r.CE),
    ]);
    await batchInsert(client, "lsbd.renewal_certification",
      ["id", "den_hyg_id", "year", "anes_incident", "convicted", "discipline", "ce"],
      rows);
    await resetSequence(client, "lsbd.renewal_certification");
    totals.push({ tbl: "renewal_certification", n: rows.length });
  }

  // ── transactions ──────────────────────────────────────────────────────────
  // Source uses lowercase "Licenseid" and "RENEWMNTH"/"EXPYEAR"/"DEPOSITNO" mixed case.
  // RenewalID is uuid → renewals.id (text uuid in JSON, but stored as Postgres uuid).
  // Stream-process — 72k rows.
  type T = {
    ID: number;
    TransId: number | null;
    Key: number | null;
    Licenseid: string | null;
    Name: string | null;
    Description: string | null;
    DateDeposit: string | null;
    RENEWMNTH: string | null;
    ExpYEAR: string | null;
    RefNum: string | null;
    DEPOSITNO: string | null;
    Fee: number | null;
    Penalty: number | null;
    Total: number | null;
    Type: string | null;
    CEHrs: number | null;
    Print: boolean | null;
    AssFEE: number | null;
    DateRenew: string | null;
    DateTrans: string | null;
    ISSUED: string | null;
    DATESTMP: string | null;
    TIMESTMP: string | null;
    PrintDate: string | null;
    MailDate: string | null;
    AppPrinted: string | null;
    LastUpdated: string | null;
    oPermitPrinted: string | null;
    pPermitPrinted: string | null;
    RenewalID: string | null;
    IndividualID: string | null;
    WellBeingFee: number | null;
  };
  {
    console.log("  streaming transactions …");
    const loaded = await streamLoad<T>(
      client,
      `${DATA_DIR}/tblTransactions.jsonl`,
      "lsbd.transactions",
      ["id", "trans_ref", "legacy_key", "license_id", "name", "description",
       "date_deposit", "renew_month", "exp_year", "ref_num", "deposit_no",
       "fee", "penalty", "total", "type", "ce_hours", "printed",
       "ass_fee", "date_renew", "date_trans", "issued",
       "date_stamp", "time_stamp", "print_date", "mail_date",
       "app_printed", "last_updated", "o_permit_printed", "p_permit_printed",
       "renewal_id", "individual_id", "well_being_fee"],
      (r) => [
        r.ID,
        intOrNull(r.TransId),
        intOrNull(r.Key),
        strOrNull(r.Licenseid),
        strOrNull(r.Name),
        strOrNull(r.Description),
        tsOrNull(r.DateDeposit),
        strOrNull(r.RENEWMNTH),
        strOrNull(r.ExpYEAR),
        strOrNull(r.RefNum),
        strOrNull(r.DEPOSITNO),
        floatOrNull(r.Fee),
        floatOrNull(r.Penalty),
        floatOrNull(r.Total),
        strOrNull(r.Type),
        floatOrNull(r.CEHrs),
        boolOrNull(r.Print),
        floatOrNull(r.AssFEE),
        tsOrNull(r.DateRenew),
        tsOrNull(r.DateTrans),
        strOrNull(r.ISSUED),
        tsOrNull(r.DATESTMP),
        strOrNull(r.TIMESTMP),
        tsOrNull(r.PrintDate),
        tsOrNull(r.MailDate),
        tsOrNull(r.AppPrinted),
        tsOrNull(r.LastUpdated),
        tsOrNull(r.oPermitPrinted),
        tsOrNull(r.pPermitPrinted),
        r.RenewalID ? (renewalsMap.get(r.RenewalID.toLowerCase()) ?? null) : null,
        // IndividualID is uuid in source but lsbd.transactions.individual_id is integer.
        // The schema's comment says "was uniqueidentifier" — schema mismatch. Coerce
        // to null since we can't safely cast uuid to int. Future: ALTER to uuid.
        null,
        floatOrNull(r.WellBeingFee),
      ],
      { batchSize: 1000, onProgress: (n) => { if (n % 10000 === 0) console.log(`    transactions: ${n}`); } }
    );
    await resetSequence(client, "lsbd.transactions");
    totals.push({ tbl: "transactions", n: loaded });
  }

  // Build transactions trans_ref → id map (for transaction_splits.transaction_id).
  // tblTransSplits.TransId → tblTransactions.TransId → transactions.id (via lsbd.transactions.trans_ref column).
  const transactionsMap = new Map<number, number>();
  {
    const res = await client.query<{ id: number; trans_ref: number | null }>(
      `SELECT id, trans_ref FROM lsbd.transactions WHERE trans_ref IS NOT NULL`
    );
    for (const r of res.rows) {
      if (r.trans_ref != null) transactionsMap.set(r.trans_ref, r.id);
    }
  }

  // ── transaction_splits ────────────────────────────────────────────────────
  type TS = {
    ID: number;
    TransId: number | null;
    Key: number | null;
    Licenseid: string | null;
    Name: string | null;
    Description: string | null;
    RefNum: string | null;
    Fee: number | null;
    Type: string | null;
    DateTrans: string | null;
  };
  {
    console.log("  streaming transaction_splits …");
    let orphans = 0;
    const loaded = await streamLoad<TS>(
      client,
      `${DATA_DIR}/tblTransSplits.jsonl`,
      "lsbd.transaction_splits",
      ["id", "transaction_id", "legacy_key", "license_id", "name", "description",
       "ref_num", "fee", "type", "date_trans"],
      (r) => {
        const txId = r.TransId != null ? (transactionsMap.get(r.TransId) ?? null) : null;
        if (r.TransId != null && txId == null) orphans++;
        return [
          r.ID,
          txId,
          intOrNull(r.Key),
          strOrNull(r.Licenseid),
          strOrNull(r.Name),
          strOrNull(r.Description),
          strOrNull(r.RefNum),
          floatOrNull(r.Fee),
          strOrNull(r.Type),
          tsOrNull(r.DateTrans),
        ];
      },
      { batchSize: 1000, onProgress: (n) => { if (n % 20000 === 0) console.log(`    transaction_splits: ${n}`); } }
    );
    await resetSequence(client, "lsbd.transaction_splits");
    if (orphans > 0) console.log(`    transaction_splits: ${orphans} orphan TransId refs → null transaction_id`);
    totals.push({ tbl: "transaction_splits", n: loaded });
  }

  // ── ADDRESS ──────────────────────────────────────────────────────────────
  // Lookups: city/state/country/parish/address_type uuid → int.
  const citiesMap = new Map<string, number>();
  const countriesMap = new Map<string, number>();
  const parishesMap = new Map<string, number>();
  const addressTypeMap = new Map<string, number>();
  {
    const c = await client.query(`SELECT id, legacy_uid::text AS uid FROM lsbd.cities`);
    for (const r of c.rows) if (r.uid) citiesMap.set(String(r.uid).toLowerCase(), r.id as number);
    const co = await client.query(`SELECT id, legacy_uid::text AS uid FROM lsbd.countries`);
    for (const r of co.rows) if (r.uid) countriesMap.set(String(r.uid).toLowerCase(), r.id as number);
    const p = await client.query(`SELECT id, legacy_uid::text AS uid FROM lsbd.parishes`);
    for (const r of p.rows) if (r.uid) parishesMap.set(String(r.uid).toLowerCase(), r.id as number);
    const a = await client.query(`SELECT id, legacy_uid::text AS uid FROM lsbd.address_type_lookup`);
    for (const r of a.rows) if (r.uid) addressTypeMap.set(String(r.uid).toLowerCase(), r.id as number);
  }
  {
    type A = {
      Address_ID: number;
      AddressID: string | null;
      LinkID: string | null;
      Address1: string | null; Address2: string | null; Address3: string | null;
      CityID: string | null; StateID: string | null; PostalCode: string | null;
      CountryID: string | null; AddressTypeID: string | null; ParishID: string | null;
      IsCurrent: boolean | null; Mailing: boolean | null;
      Updated: string | null; Home: boolean | null; FLG_DUP: boolean | null;
      CITY: string | null; STATE: string | null; COUNTRY: string | null;
      Individual_ID: number | null; Office_ID: number | null;
    };
    const src = await readJsonl<A>(`${DATA_DIR}/ADDRESS.jsonl`);
    const rows = src.map((r) => [
      r.Address_ID,
      strOrNull(r.AddressID),
      strOrNull(r.LinkID),
      strOrNull(r.Address1), strOrNull(r.Address2), strOrNull(r.Address3),
      r.CityID ? (citiesMap.get(r.CityID.toLowerCase()) ?? null) : null,
      r.StateID ? (statesMap.get(r.StateID.toLowerCase()) ?? null) : null,
      strOrNull(r.PostalCode),
      r.CountryID ? (countriesMap.get(r.CountryID.toLowerCase()) ?? null) : null,
      r.AddressTypeID ? (addressTypeMap.get(r.AddressTypeID.toLowerCase()) ?? null) : null,
      r.ParishID ? (parishesMap.get(r.ParishID.toLowerCase()) ?? null) : null,
      boolOrNull(r.IsCurrent), boolOrNull(r.Mailing),
      tsOrNull(r.Updated), boolOrNull(r.Home), boolOrNull(r.FLG_DUP),
      strOrNull(r.CITY), strOrNull(r.STATE), strOrNull(r.COUNTRY),
      intOrNull(r.Individual_ID), intOrNull(r.Office_ID),
    ]);
    await batchInsert(client, "lsbd.address",
      ["id", "legacy_uid", "link_uid",
       "address_1", "address_2", "address_3",
       "city_id", "state_id", "postal_code",
       "country_id", "address_type_id", "parish_id",
       "is_current", "mailing", "updated", "home", "flg_dup",
       "city_text", "state_text", "country_text",
       "individual_id", "office_id"],
      rows);
    await resetSequence(client, "lsbd.address");
    totals.push({ tbl: "address", n: rows.length });
  }

  // ── address_history ──────────────────────────────────────────────────────
  // Flat snapshot — no FK resolution.
  {
    type AH = {
      ID: number;
      LICENSEID: string | null; Type: string | null;
      FIRSTName: string | null; MIDDLE: string | null; LASTName: string | null;
      Address1: string | null; Address2: string | null;
      CITY: string | null; STATE: string | null; ZIP: string | null;
      COUNTY: string | null; Email: string | null;
      AddressO1: string | null; AddressO2: string | null;
      CITYO: string | null; STATEO: string | null; ZIPO: string | null; COUNTYO: string | null;
      Updated: string | null; UpdatedBy: string | null; OPT_IN: string | null; DEANO: string | null;
    };
    const src = await readJsonl<AH>(`${DATA_DIR}/AddressHistory.jsonl`);
    const rows = src.map((r) => [
      r.ID,
      strOrNull(r.LICENSEID), strOrNull(r.Type),
      strOrNull(r.FIRSTName), strOrNull(r.MIDDLE), strOrNull(r.LASTName),
      strOrNull(r.Address1), strOrNull(r.Address2),
      strOrNull(r.CITY), strOrNull(r.STATE), strOrNull(r.ZIP), strOrNull(r.COUNTY),
      strOrNull(r.Email),
      strOrNull(r.AddressO1), strOrNull(r.AddressO2),
      strOrNull(r.CITYO), strOrNull(r.STATEO), strOrNull(r.ZIPO), strOrNull(r.COUNTYO),
      tsOrNull(r.Updated), strOrNull(r.UpdatedBy), strOrNull(r.OPT_IN), strOrNull(r.DEANO),
    ]);
    await batchInsert(client, "lsbd.address_history",
      ["id", "license_id", "type",
       "first_name", "middle", "last_name",
       "address_1", "address_2", "city", "state", "zip", "county", "email",
       "address_o_1", "address_o_2", "city_o", "state_o", "zip_o", "county_o",
       "updated", "updated_by", "opt_in", "deano"], rows);
    await resetSequence(client, "lsbd.address_history");
    totals.push({ tbl: "address_history", n: rows.length });
  }

  // ── individual_affiliation ───────────────────────────────────────────────
  // FKs: dentist_id, individual_id (uuids → individual.individual_id).
  // Build individual uuid set so we can null orphans.
  const individualUuidSet = new Set<string>();
  {
    const res = await client.query(`SELECT individual_id::text AS uid FROM lsbd.individual`);
    for (const r of res.rows) individualUuidSet.add(String(r.uid).toLowerCase());
  }
  {
    type IA = {
      IndividualAffiliation_ID: number;
      IndividualAffiliationID: string;
      DentistID: string | null; DENTID: number | null;
      IndividualID: string | null; INDVID: number | null;
    };
    const src = await readJsonl<IA>(`${DATA_DIR}/IndividualAffiliation.jsonl`);
    let denOrphans = 0, indOrphans = 0;
    const rows = src.map((r) => {
      let den: string | null = strOrNull(r.DentistID);
      let ind: string | null = strOrNull(r.IndividualID);
      if (den && !individualUuidSet.has(den.toLowerCase())) { denOrphans++; den = null; }
      if (ind && !individualUuidSet.has(ind.toLowerCase())) { indOrphans++; ind = null; }
      return [
        r.IndividualAffiliation_ID,
        strOrNull(r.IndividualAffiliationID),
        den, ind,
        intOrNull(r.DENTID), intOrNull(r.INDVID),
        r.IndividualAffiliation_ID,
      ];
    });
    if (denOrphans || indOrphans) console.log(`  individual_affiliation: ${denOrphans} orphan dentist_id, ${indOrphans} orphan individual_id nulled`);
    await batchInsert(client, "lsbd.individual_affiliation",
      ["id", "individual_affiliation_uuid",
       "dentist_id", "individual_id",
       "dentist_legacy_id", "individual_legacy_id", "legacy_id"], rows);
    await resetSequence(client, "lsbd.individual_affiliation");
    totals.push({ tbl: "individual_affiliation", n: rows.length });
  }

  // ── office_affiliation ───────────────────────────────────────────────────
  // FKs: dentist_id (uuid in OfficeAffiliation), office_id (uuid). Drizzle has
  // dentist_uid + office_uid as uuids (not FK-enforced), plus dentist_id +
  // office_id as integers. Pass uuids through (no enforced FK) plus ints.
  {
    type OA = {
      OfficeAffiliation_ID: number;
      OfficeAffiliationID: string;
      DentistID: string | null; DENTIST_ID: number | null;
      OfficeID: string | null; OFFICE_ID: number | null;
      OfficePermit: boolean | null;
    };
    const src = await readJsonl<OA>(`${DATA_DIR}/OfficeAffiliation.jsonl`);
    const rows = src.map((r) => [
      r.OfficeAffiliation_ID,
      strOrNull(r.OfficeAffiliationID),
      strOrNull(r.DentistID), strOrNull(r.OfficeID),
      boolOrNull(r.OfficePermit),
      intOrNull(r.DENTIST_ID), intOrNull(r.OFFICE_ID),
    ]);
    await batchInsert(client, "lsbd.office_affiliation",
      ["id", "legacy_uid", "dentist_uid", "office_uid",
       "office_permit", "dentist_id", "office_id"], rows);
    await resetSequence(client, "lsbd.office_affiliation");
    totals.push({ tbl: "office_affiliation", n: rows.length });
  }

  // ── office_aff_history ───────────────────────────────────────────────────
  {
    type OAH = {
      ID: number;
      LicenseID: string | null; LicenseType: string | null;
      OfficeID: number | null;
      OperationType: string | null;
      Updated: string | null; UpdatedBy: string | null;
    };
    const src = await readJsonl<OAH>(`${DATA_DIR}/OfficeAffHistory.jsonl`);
    const rows = src.map((r) => [
      r.ID,
      strOrNull(r.LicenseID), strOrNull(r.LicenseType),
      intOrNull(r.OfficeID),
      strOrNull(r.OperationType),
      tsOrNull(r.Updated), strOrNull(r.UpdatedBy),
    ]);
    await batchInsert(client, "lsbd.office_aff_history",
      ["id", "license_id", "license_type", "office_id",
       "operation_type", "updated", "updated_by"], rows);
    await resetSequence(client, "lsbd.office_aff_history");
    totals.push({ tbl: "office_aff_history", n: rows.length });
  }

  // ── association_history ─────────────────────────────────────────────────
  {
    type AH = {
      ID: number;
      LicenseID: string | null; LicenseType: string | null;
      AssociatedLicenseID: string | null; AssociatedLicenseType: string | null;
      OperationType: string | null; Updated: string | null; UpdatedBy: string | null;
    };
    const src = await readJsonl<AH>(`${DATA_DIR}/AssociationHistory.jsonl`);
    const rows = src.map((r) => [
      r.ID,
      strOrNull(r.LicenseID), strOrNull(r.LicenseType),
      strOrNull(r.AssociatedLicenseID), strOrNull(r.AssociatedLicenseType),
      strOrNull(r.OperationType),
      tsOrNull(r.Updated), strOrNull(r.UpdatedBy),
    ]);
    await batchInsert(client, "lsbd.association_history",
      ["id", "license_id", "license_type",
       "associated_license_id", "associated_license_type",
       "operation_type", "updated_at", "updated_by"], rows);
    await resetSequence(client, "lsbd.association_history");
    totals.push({ tbl: "association_history", n: rows.length });
  }

  // ── professional_llc ─────────────────────────────────────────────────────
  {
    type L = {
      Key: number;
      LICENSEID: string | null; ESTNAME: string | null; STATUS: string | null;
      DateSince: string | null; DateUpdated: string | null;
      DateRenew: string | null; DateUntil: string | null;
      RenewMnth: string | null; RegYear: string | null;
      ADDR_NAME1: string | null; ADDR_NAME2: string | null;
      SORT1: string | null; SORT2: string | null;
      COMMENT1: string | null; COMMENT2: string | null; COMMENT3: string | null;
      ADDRESS1: string | null; ADDRESS2: string | null; ADDRESS3: string | null;
      CITY: string | null; STATE: string | null; ZIP: string | null; COUNTY: string | null;
      Phone1: string | null; Ext1: string | null;
      Phone2: string | null; Ext2: string | null;
      Fax: string | null; Notes: string | null; Location: string | null;
      Email: string | null; URL: string | null; Type: string | null;
      Office_ID: number | null; OldOfficeID: number | null;
    };
    const src = await readJsonl<L>(`${DATA_DIR}/tblPLLCs.jsonl`);
    const rows = src.map((r) => [
      r.Key,
      strOrNull(r.LICENSEID), strOrNull(r.ESTNAME), strOrNull(r.STATUS),
      tsOrNull(r.DateSince), tsOrNull(r.DateUpdated),
      tsOrNull(r.DateRenew), tsOrNull(r.DateUntil),
      strOrNull(r.RenewMnth), strOrNull(r.RegYear),
      strOrNull(r.ADDR_NAME1), strOrNull(r.ADDR_NAME2),
      strOrNull(r.SORT1), strOrNull(r.SORT2),
      strOrNull(r.COMMENT1), strOrNull(r.COMMENT2), strOrNull(r.COMMENT3),
      strOrNull(r.ADDRESS1), strOrNull(r.ADDRESS2), strOrNull(r.ADDRESS3),
      strOrNull(r.CITY), strOrNull(r.STATE), strOrNull(r.ZIP), strOrNull(r.COUNTY),
      strOrNull(r.Phone1), strOrNull(r.Ext1),
      strOrNull(r.Phone2), strOrNull(r.Ext2),
      strOrNull(r.Fax), strOrNull(r.Notes), strOrNull(r.Location),
      strOrNull(r.Email), strOrNull(r.URL), strOrNull(r.Type),
      intOrNull(r.Office_ID), intOrNull(r.OldOfficeID),
    ]);
    await batchInsert(client, "lsbd.professional_llc",
      ["id", "license_id", "est_name", "status",
       "date_since", "date_updated", "date_renew", "date_until",
       "renew_month", "reg_year",
       "addr_name1", "addr_name2", "sort1", "sort2",
       "comment1", "comment2", "comment3",
       "address1", "address2", "address3",
       "city", "state", "zip", "county",
       "phone1", "ext1", "phone2", "ext2",
       "fax", "notes", "location", "email", "url", "type",
       "office_id", "old_office_id"], rows);
    await resetSequence(client, "lsbd.professional_llc");
    totals.push({ tbl: "professional_llc", n: rows.length });
  }

  // ── vs_auth ──────────────────────────────────────────────────────────────
  {
    type V = {
      DATE_CREATED: string | null;
      AMT: string | null; ACCT: string | null; EXPDATE: string | null;
      CARDHOLDER: string | null;
      STREET: string | null; CITY: string | null; STATE: string | null; ZIP: string | null;
      PNREF: string;
      RESULT: string | null; RESPMSG: string | null; AUTHCODE: string | null;
      AVSADDR: string | null; AVSZIP: string | null;
      LICID: string | null; LicType: string | null; Type: string | null;
    };
    const src = await readJsonl<V>(`${DATA_DIR}/VSAuth.jsonl`);
    const rows = src.map((r) => [
      tsOrNull(r.DATE_CREATED),
      strOrNull(r.AMT), strOrNull(r.ACCT), strOrNull(r.EXPDATE),
      strOrNull(r.CARDHOLDER),
      strOrNull(r.STREET), strOrNull(r.CITY), strOrNull(r.STATE), strOrNull(r.ZIP),
      r.PNREF,
      strOrNull(r.RESULT), strOrNull(r.RESPMSG), strOrNull(r.AUTHCODE),
      strOrNull(r.AVSADDR), strOrNull(r.AVSZIP),
      strOrNull(r.LICID), strOrNull(r.LicType), strOrNull(r.Type),
    ]);
    await batchInsert(client, "lsbd.vs_auth",
      ["date_created", "amt", "acct", "exp_date",
       "card_holder", "street", "city", "state", "zip", "pnref",
       "result", "resp_msg", "auth_code", "avs_addr", "avs_zip",
       "lic_id", "lic_type", "type"], rows);
    await resetSequence(client, "lsbd.vs_auth");
    totals.push({ tbl: "vs_auth", n: rows.length });
  }

  // ── vs_capture ───────────────────────────────────────────────────────────
  {
    type V = {
      DATE_CREATED: string | null;
      ORIGID: string | null;
      PNREF: string;
      RESULT: string | null; RESPMSG: string | null; AUTHCODE: string | null;
      AVSADDR: string | null; AVSZIP: string | null;
    };
    const src = await readJsonl<V>(`${DATA_DIR}/VsCapture.jsonl`);
    const rows = src.map((r) => [
      tsOrNull(r.DATE_CREATED),
      strOrNull(r.ORIGID),
      r.PNREF,
      strOrNull(r.RESULT), strOrNull(r.RESPMSG), strOrNull(r.AUTHCODE),
      strOrNull(r.AVSADDR), strOrNull(r.AVSZIP),
    ]);
    await batchInsert(client, "lsbd.vs_capture",
      ["date_created", "orig_id", "pnref",
       "result", "resp_msg", "auth_code", "avs_addr", "avs_zip"], rows);
    await resetSequence(client, "lsbd.vs_capture");
    totals.push({ tbl: "vs_capture", n: rows.length });
  }

  console.log("\nLoaded:");
  for (const t of totals) console.log(`  ${t.tbl}: ${t.n}`);
  console.log(`Total: ${totals.reduce((a, b) => a + b.n, 0)} rows across ${totals.length} tables.`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
