-- supabase/transforms/70_financial.sql
--
-- Domain "financial" (Task 14): transactions (tblTransactions, ~72k rows) and
-- transaction_splits (tblTransSplits, ~126k rows). Ported from scripts/etl-b3.ts.
--
-- MONEY (controller carry 7): the source amounts are SQL Server float (lsbd_raw float8).
-- lsbd stores them as exact numeric(19,4) (drizzle/0004_money_numeric.sql); the transform
-- casts float8 -> numeric(19,4). Postgres converts float8 to numeric with 15 significant
-- digits, so a source 12.34 lands as exactly 12.34 (float8 12.339999999999999857... does
-- not leak through) and float noise such as 0.1+0.2 lands as 0.3. Never float in lsbd.
-- The May ETL loaded them through floatOrNull into double precision.
-- ce_hours stays double precision (hours, not money).
--
-- Value rules (as in Task 11): strOrNull -> lsbd._s(x); every timestamptz target is
-- (<col> AT TIME ZONE 'America/Chicago').
-- Keys (0003 KEY MAP): transactions.id = tblTransactions.ID, transaction_splits.id =
-- tblTransSplits.ID (inserted explicitly); legacy_key = Key and trans_ref = TransId are
-- data, not keys.
--
-- References: "lookup, not gate" (controller carry 1): every row is loaded (a financial row
-- is never dropped for a dangling link); an unresolved reference is NULL and counted
-- 'unlinked' in lsbd._transform_quality.
--   transaction_splits.transaction_id -> transactions (DB FK): TransId -> the live
--     tblTransactions row with that TransId. TransId is not unique in the source (139 live
--     TransIds are used by 2 transactions each, always with different Keys); a TransId
--     shared by several transactions is disambiguated by (TransId, Key); still ambiguous
--     -> NULL. (The May ETL let whichever row came last win.)
--   transactions.renewal_id -> renewals (DB FK): RenewalID uuid -> live Renewals.Renewal_ID.
--     (Today no source RenewalID matches a Renewals row, so it is NULL everywhere.)
--   transactions.individual_id (integer, "was uniqueidentifier"): IndividualID uuid ->
--     lsbd._src_individual -> its INDVID. (Today no source IndividualID matches an
--     Individual, so it is NULL everywhere, as the May ETL wrote it.)
--   The DB-FK references are NULLed by _unlink() in the delete phase, before the parent row
--   is deleted: splits here, renewals later in the operational domain (sort_order 60).

DROP VIEW IF EXISTS lsbd._src_transactions, lsbd._src_transaction_splits CASCADE;

CREATE VIEW lsbd._src_transactions WITH (security_invoker = true) AS
SELECT r."ID"                        AS id,
       r."TransId"                   AS trans_ref,
       r."Key"                       AS legacy_key,
       lsbd._s(r."Licenseid")        AS license_id,
       lsbd._s(r."Name")             AS name,
       lsbd._s(r."Description")      AS description,
       (r."DateDeposit" AT TIME ZONE 'America/Chicago') AS date_deposit,
       lsbd._s(r."RENEWMNTH")        AS renew_month,
       lsbd._s(r."ExpYEAR")          AS exp_year,
       lsbd._s(r."RefNum")           AS ref_num,
       lsbd._s(r."DEPOSITNO")        AS deposit_no,
       r."Fee"::numeric(19,4)        AS fee,
       r."Penalty"::numeric(19,4)    AS penalty,
       r."Total"::numeric(19,4)      AS total,
       lsbd._s(r."Type")             AS type,
       r."CEHrs"                     AS ce_hours,
       r."Print"                     AS printed,
       r."AssFEE"::numeric(19,4)     AS ass_fee,
       (r."DateRenew" AT TIME ZONE 'America/Chicago') AS date_renew,
       (r."DateTrans" AT TIME ZONE 'America/Chicago') AS date_trans,
       lsbd._s(r."ISSUED")           AS issued,
       (r."DATESTMP" AT TIME ZONE 'America/Chicago') AS date_stamp,
       lsbd._s(r."TIMESTMP")         AS time_stamp,
       (r."PrintDate"      AT TIME ZONE 'America/Chicago') AS print_date,
       (r."MailDate"       AT TIME ZONE 'America/Chicago') AS mail_date,
       (r."AppPrinted"     AT TIME ZONE 'America/Chicago') AS app_printed,
       (r."LastUpdated"    AT TIME ZONE 'America/Chicago') AS last_updated,
       (r."oPermitPrinted" AT TIME ZONE 'America/Chicago') AS o_permit_printed,
       (r."pPermitPrinted" AT TIME ZONE 'America/Chicago') AS p_permit_printed,
       rn.id                         AS renewal_id,
       i.indv_id                     AS individual_id,
       r."WellBeingFee"::numeric(19,4) AS well_being_fee
  FROM lsbd_raw."tblTransactions" r
  LEFT JOIN (SELECT x."RenewalID" AS uid, min(x."Renewal_ID") AS id FROM lsbd_raw."Renewals" x
              WHERE x._deleted_at IS NULL AND x."Renewal_ID" IS NOT NULL AND x."RenewalID" IS NOT NULL
              GROUP BY x."RenewalID") rn ON rn.uid = r."RenewalID"
  LEFT JOIN lsbd._src_individual i ON i.individual_id = r."IndividualID"
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_transaction_splits WITH (security_invoker = true) AS
SELECT r."ID"                        AS id,
       CASE WHEN a.n = 1 THEN a.id WHEN b.n = 1 THEN b.id END AS transaction_id,
       r."Key"                       AS legacy_key,
       lsbd._s(r."Licenseid")        AS license_id,
       lsbd._s(r."Name")             AS name,
       lsbd._s(r."Description")      AS description,
       lsbd._s(r."RefNum")           AS ref_num,
       r."Fee"::numeric(19,4)        AS fee,
       lsbd._s(r."Type")             AS type,
       (r."DateTrans" AT TIME ZONE 'America/Chicago') AS date_trans
  FROM lsbd_raw."tblTransSplits" r
  LEFT JOIN (SELECT x."TransId" AS ref, count(*) AS n, min(x."ID") AS id FROM lsbd_raw."tblTransactions" x
              WHERE x._deleted_at IS NULL AND x."ID" IS NOT NULL AND x."TransId" IS NOT NULL
              GROUP BY x."TransId") a ON a.ref = r."TransId"
  LEFT JOIN (SELECT x."TransId" AS ref, x."Key" AS k, count(*) AS n, min(x."ID") AS id FROM lsbd_raw."tblTransactions" x
              WHERE x._deleted_at IS NULL AND x."ID" IS NOT NULL AND x."TransId" IS NOT NULL AND x."Key" IS NOT NULL
              GROUP BY x."TransId", x."Key") b ON b.ref = r."TransId" AND b.k = r."Key"
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE OR REPLACE FUNCTION lsbd.transform_financial(phase text DEFAULT 'all')
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  o integer := 0;
BEGIN
  IF phase NOT IN ('all', 'delete', 'upsert') THEN
    RAISE EXCEPTION 'transform_financial: unknown phase %', phase;
  END IF;

  IF phase IN ('all', 'delete') THEN
    PERFORM lsbd._delete('lsbd.transaction_splits', 'lsbd._src_transaction_splits', '{id}');
    PERFORM lsbd._unlink('lsbd.transaction_splits', 'transaction_id',
      'SELECT 1 FROM lsbd._src_transactions s WHERE s.id = t.transaction_id');
    PERFORM lsbd._delete('lsbd.transactions',       'lsbd._src_transactions',       '{id}');
    -- renewals live in the operational domain (deleted after this one)
    PERFORM lsbd._unlink('lsbd.transactions', 'renewal_id',
      'SELECT 1 FROM lsbd._src_renewals s WHERE s.id = t.renewal_id');
  END IF;

  IF phase IN ('all', 'upsert') THEN
    o := o + lsbd._upsert('lsbd.transactions',       'lsbd._src_transactions',       '{id}', 'tblTransactions');
    o := o + lsbd._upsert('lsbd.transaction_splits', 'lsbd._src_transaction_splits', '{id}', 'tblTransSplits');

    PERFORM lsbd._count_unlinked('lsbd.transactions', 'renewal_id -> renewals', 'tblTransactions',
      'r."ID" = t.id', 'r."RenewalID"', 'renewal_id');
    PERFORM lsbd._count_unlinked('lsbd.transactions', 'individual_id -> individual', 'tblTransactions',
      'r."ID" = t.id', 'r."IndividualID"', 'individual_id');
    PERFORM lsbd._count_unlinked('lsbd.transaction_splits', 'transaction_id -> transactions', 'tblTransSplits',
      'r."ID" = t.id', 'r."TransId"', 'transaction_id');
  END IF;
  RETURN o;
END;
$$;

INSERT INTO lsbd._transform_registry (domain, fn, sort_order, source_tables)
VALUES ('financial', 'lsbd.transform_financial'::regproc, 70, ARRAY[
  -- own sources
  'tblTransactions', 'tblTransSplits',
  -- parents
  'Renewals', 'Individual'])
ON CONFLICT (domain) DO UPDATE
  SET fn = EXCLUDED.fn, sort_order = EXCLUDED.sort_order, source_tables = EXCLUDED.source_tables;

SELECT lsbd._lockdown();
