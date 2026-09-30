-- supabase/transforms/99_run.sql
--
-- lsbd.run_transforms: the entry point the sync runner calls
-- (scripts/sync/run.ts: CALL lsbd.run_transforms(changed_sources => $1::text[], orphans => 0)).
--
--   changed_sources NULL  -> every registered domain (full mode, --tables none,
--                            or after a failed run).
--   changed_sources array -> only domains whose source_tables overlap it.
--                            A domain lists its parents' raw tables too, so it
--                            also re-runs when an upstream table changed.
--   1. delete phases of the selected domains, reverse sort_order
--      (children before parents);
--   2. upsert phases, sort_order (parents before children);
--   3. serial sequences bumped to max(id) (never moved backwards).
--   orphans (INOUT) = rows skipped by the upsert phases.
-- It runs inside the caller's transaction (no COMMIT here), so readers never
-- see a half-applied state. Domains register themselves in
-- lsbd._transform_registry; this file never needs editing to add one.

CREATE OR REPLACE PROCEDURE lsbd.run_transforms(changed_sources text[] DEFAULT NULL, INOUT orphans integer DEFAULT 0)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  d       record;
  n       integer;
  total   integer := 0;
  started timestamptz;
BEGIN
  FOR d IN
    SELECT domain, fn FROM lsbd._transform_registry
     WHERE changed_sources IS NULL OR source_tables && changed_sources
     ORDER BY sort_order DESC
  LOOP
    started := clock_timestamp();
    EXECUTE format('SELECT %s($1)', d.fn) USING 'delete' INTO n;
    RAISE NOTICE 'transform % delete: % ms', d.domain,
      round(extract(epoch FROM clock_timestamp() - started) * 1000);
  END LOOP;

  FOR d IN
    SELECT domain, fn FROM lsbd._transform_registry
     WHERE changed_sources IS NULL OR source_tables && changed_sources
     ORDER BY sort_order
  LOOP
    started := clock_timestamp();
    EXECUTE format('SELECT %s($1)', d.fn) USING 'upsert' INTO n;
    total := total + COALESCE(n, 0);
    RAISE NOTICE 'transform % upsert: % ms, % skipped', d.domain,
      round(extract(epoch FROM clock_timestamp() - started) * 1000), COALESCE(n, 0);
  END LOOP;

  PERFORM lsbd._bump_sequences();
  orphans := total;
END;
$$;

SELECT lsbd._lockdown();
