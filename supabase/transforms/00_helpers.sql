-- supabase/transforms/00_helpers.sql
--
-- Transform framework (Task 11, spec section 4.2). Applied by
-- scripts/sync/apply-transforms.ts, one file per transaction, in filename order.
-- Every object here is CREATE OR REPLACE / IF NOT EXISTS, so re-applying is safe.
--
-- Shape of a domain (10_lookups.sql ... 40_denhyg_pii.sql, and Task 14's files):
--   * One private view per target table, lsbd._src_<table>. It selects the LIVE
--     raw rows (_deleted_at IS NULL) that are eligible (key not NULL, every
--     parent present), already mapped to the target's column names and types.
--     Eligibility is computed from lsbd_raw (via the parent's _src_ view), never
--     from lsbd, so the delete pass (which runs before any upsert) and the
--     upsert pass agree, and a parent row is never deleted while an eligible
--     child still points at it.
--   * lsbd.transform_<domain>(phase text DEFAULT 'all') RETURNS integer.
--     phase 'delete': lsbd._delete() per table, children before parents.
--     phase 'upsert': lsbd._upsert() per table, parents before children;
--                     returns the number of raw rows skipped (orphans).
--     phase 'all'   : delete, then upsert (standalone use).
--   * A row in lsbd._transform_registry (domain, fn, sort_order, source_tables).
--     source_tables lists the domain's own raw tables AND every raw table its
--     eligibility depends on (transitively), so a parent change re-runs it.
--
-- lsbd.run_transforms (99_run.sql) runs the delete phases in reverse
-- sort_order, then the upsert phases in sort_order, then bumps sequences.

-- ---------------------------------------------------------------------------
-- Registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lsbd._transform_registry (
  domain        text PRIMARY KEY,
  fn            regproc NOT NULL,
  sort_order    int NOT NULL,
  source_tables text[] NOT NULL
);
ALTER TABLE lsbd._transform_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lsbd._transform_registry FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Value helpers (inlined by the planner: IMMUTABLE SQL, no SET clause)
-- ---------------------------------------------------------------------------

-- The May ETL's strOrNull(): trim, then '' -> NULL. (JS String.trim() also
-- strips other whitespace; tab/CR/LF/FF/VT cover what the source contains.)
CREATE OR REPLACE FUNCTION lsbd._s(v text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT NULLIF(btrim(v, E' \t\r\n\f\v'), '') $$;

-- ---------------------------------------------------------------------------
-- lsbd._refresh_stats(target, changed): ANALYZE target when its planner stats
-- are stale enough to produce a nested-loop plan over thousands of rows.
-- Without this, a first load (or stats reset to 0 rows by autovacuum after a
-- rolled-back load) plans NOT EXISTS / joins as if lsbd.person had 1 row, and
-- a 19k x 19k nested loop never finishes. ANALYZE inside the transaction
-- counts this transaction's own uncommitted rows, so it sees the new data.
--   changed > 0: ANALYZE when changed >= 1000 and > 20% of reltuples.
--   changed = 0: ANALYZE when reltuples says empty/unknown but rows exist.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lsbd._refresh_stats(target regclass, changed bigint)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  est  real;
  has_rows boolean;
BEGIN
  SELECT c.reltuples INTO est FROM pg_catalog.pg_class c WHERE c.oid = target;
  IF changed > 0 THEN
    IF changed >= 1000 AND changed > 0.2 * GREATEST(est, 0) THEN
      EXECUTE format('ANALYZE %s', target);
    END IF;
  ELSIF est <= 0 THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s)', target) INTO has_rows;
    IF has_rows THEN
      EXECUTE format('ANALYZE %s', target);
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- lsbd._upsert(target, src, key_cols, count_src)
--   INSERT INTO target (<src cols>) SELECT <src cols> FROM src
--     WHERE NOT EXISTS (<identical row already in target>)   -- new/changed only
--   ON CONFLICT (<key_cols>) DO UPDATE SET <non-key cols> = EXCLUDED.<...>
--     WHERE (<target non-key cols>) IS DISTINCT FROM (<excluded non-key cols>)
--   The column list is the src view's columns, so a generated serial id is
--   never written (it is not in the view) and never overwritten on conflict.
--   count_src: the lsbd_raw table whose live rows map 1:1 onto src; the rows
--   it has but src doesn't (NULL key, missing parent, duplicate) are returned
--   as skipped (orphans). NULL = do not count (fan-out tables, or rows already
--   counted on the parent).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lsbd._upsert(target regclass, src regclass, key_cols text[], count_src text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  cols   text[];
  upd    text[];
  q      text;
  n_live bigint;
  n_src  bigint;
  n_rows bigint;
  skipped integer := 0;
BEGIN
  SELECT array_agg(a.attname::text ORDER BY a.attnum) INTO cols
    FROM pg_catalog.pg_attribute a
   WHERE a.attrelid = src AND a.attnum > 0 AND NOT a.attisdropped;
  IF cols IS NULL THEN
    RAISE EXCEPTION 'lsbd._upsert: % has no columns', src;
  END IF;
  upd := ARRAY(SELECT x FROM unnest(cols) AS x WHERE x <> ALL (key_cols));

  -- Only new or changed source rows are proposed for insertion: INSERT ... ON
  -- CONFLICT evaluates the serial default (nextval) for EVERY proposed row, so
  -- proposing all ~20k unchanged rows each run would burn ~20k ids per table
  -- per run and exhaust int4 sequences within a few years.
  q := format('INSERT INTO %s AS t (%s) SELECT %s FROM %s WHERE NOT EXISTS (SELECT 1 FROM %s AS u WHERE %s%s) ON CONFLICT (%s) ',
              target,
              (SELECT string_agg(format('%I', x), ', ') FROM unnest(cols) AS x),
              (SELECT string_agg(format('s.%I', x), ', ') FROM unnest(cols) AS x),
              src || ' AS s',
              target,
              (SELECT string_agg(format('u.%1$I = s.%1$I', x), ' AND ') FROM unnest(key_cols) AS x),
              CASE WHEN cardinality(upd) = 0 THEN ''
                   ELSE format(' AND (%s) IS NOT DISTINCT FROM (%s)',
                               (SELECT string_agg(format('u.%I', x), ', ') FROM unnest(upd) AS x),
                               (SELECT string_agg(format('s.%I', x), ', ') FROM unnest(upd) AS x))
              END,
              (SELECT string_agg(format('%I', x), ', ') FROM unnest(key_cols) AS x));
  IF cardinality(upd) = 0 THEN
    q := q || 'DO NOTHING';
  ELSIF cardinality(upd) = 1 THEN
    q := q || format('DO UPDATE SET %1$I = EXCLUDED.%1$I WHERE t.%1$I IS DISTINCT FROM EXCLUDED.%1$I', upd[1]);
  ELSE
    q := q || format('DO UPDATE SET (%s) = (%s) WHERE (%s) IS DISTINCT FROM (%s)',
                     (SELECT string_agg(format('%I', x), ', ') FROM unnest(upd) AS x),
                     (SELECT string_agg(format('EXCLUDED.%I', x), ', ') FROM unnest(upd) AS x),
                     (SELECT string_agg(format('t.%I', x), ', ') FROM unnest(upd) AS x),
                     (SELECT string_agg(format('EXCLUDED.%I', x), ', ') FROM unnest(upd) AS x));
  END IF;
  EXECUTE q;
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  PERFORM lsbd._refresh_stats(target, n_rows);

  IF count_src IS NOT NULL THEN
    EXECUTE format('SELECT count(*) FROM lsbd_raw.%I WHERE _deleted_at IS NULL', count_src) INTO n_live;
    EXECUTE format('SELECT count(*) FROM %s', src) INTO n_src;
    skipped := GREATEST(n_live - n_src, 0)::integer;
    IF skipped > 0 THEN
      RAISE NOTICE 'transform %: % of % live lsbd_raw.% rows skipped (orphan / unkeyable / duplicate)',
        target, skipped, n_live, count_src;
    END IF;
  END IF;
  RETURN skipped;
END;
$$;

-- ---------------------------------------------------------------------------
-- lsbd._delete(target, src, key_cols, target_filter)
--   DELETE FROM target t WHERE NOT EXISTS (SELECT 1 FROM src s WHERE s.k = t.k ...)
--   src only holds live (_deleted_at IS NULL) eligible rows. NOT EXISTS, never
--   NOT IN: one NULL key would make NOT IN delete nothing. Key columns are
--   NOT NULL on every target, so '=' is exact.
--   target_filter: optional SQL predicate on t limiting which target rows the
--   sync owns (e.g. app_settings keys with a legacy prefix).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lsbd._delete(target regclass, src regclass, key_cols text[], target_filter text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  PERFORM lsbd._refresh_stats(target, 0);
  EXECUTE format('DELETE FROM %s AS t WHERE NOT EXISTS (SELECT 1 FROM %s AS s WHERE %s)%s',
                 target, src,
                 (SELECT string_agg(format('s.%1$I = t.%1$I', x), ' AND ') FROM unnest(key_cols) AS x),
                 CASE WHEN target_filter IS NULL THEN '' ELSE ' AND (' || target_filter || ')' END);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM lsbd._refresh_stats(target, n);
  RETURN n;
END;
$$;

-- ---------------------------------------------------------------------------
-- lsbd._bump_sequences(): for every lsbd table with a serial "id", move the
-- sequence up to max(id) when a transform inserted explicit source PKs past
-- it. Never moves a sequence backwards (generated ids are never reused).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lsbd._bump_sequences()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  r    record;
  m    bigint;
  last bigint;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS tbl, pg_catalog.pg_get_serial_sequence(c.oid::regclass::text, 'id') AS seq
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id' AND NOT a.attisdropped
     WHERE c.relnamespace = 'lsbd'::regnamespace AND c.relkind = 'r'
  LOOP
    CONTINUE WHEN r.seq IS NULL;
    EXECUTE format('SELECT max(id) FROM %s', r.tbl) INTO m;
    CONTINUE WHEN m IS NULL;
    last := pg_catalog.pg_sequence_last_value(r.seq::regclass);
    IF last IS NULL OR m > last THEN
      PERFORM pg_catalog.setval(r.seq, m, true);
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- lsbd._lockdown(): the _src_ views read lsbd_raw (SSN-HMACs, DOB) and the
-- transform routines rewrite lsbd.*; only the postgres role may touch them.
-- Each domain file calls this after creating its objects.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lsbd._lockdown()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS v FROM pg_catalog.pg_class c
     WHERE c.relnamespace = 'lsbd'::regnamespace AND c.relkind = 'v' AND c.relname LIKE '\_src\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON %s FROM PUBLIC, anon, authenticated', r.v);
  END LOOP;
  FOR r IN
    SELECT p.oid::regprocedure AS f, p.prokind FROM pg_catalog.pg_proc p
     WHERE p.pronamespace = 'lsbd'::regnamespace
       AND (p.proname LIKE '\_%' OR p.proname LIKE 'transform\_%' OR p.proname = 'run_transforms')
  LOOP
    EXECUTE format('REVOKE ALL ON %s %s FROM PUBLIC, anon, authenticated',
                   CASE WHEN r.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END, r.f);
  END LOOP;
END;
$$;

SELECT lsbd._lockdown();
