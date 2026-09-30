import type { Client } from "pg";

/**
 * setval() is not transactional: when a rolled-back test transaction ran lsbd.run_transforms,
 * lsbd._bump_sequences() has already moved the serial sequence of every table that received a
 * synthetic id (>= 900000000) past that id, and the ROLLBACK does not undo it. Call this after
 * the ROLLBACK: it puts every such sequence back to max(id) of the table (only sequences at or
 * above the synthetic range, only when no committed row is that high). The scheduled sync is
 * paused while IT tests run, so nothing else is writing these tables.
 */
export async function restoreSyntheticSequences(c: Client): Promise<void> {
  await c.query(`
    DO $$
    DECLARE
      r record;
      seq text;
      m bigint;
    BEGIN
      FOR r IN
        SELECT c.oid::regclass AS tbl
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id' AND NOT a.attisdropped
         WHERE c.relnamespace = 'lsbd'::regnamespace AND c.relkind = 'r'
      LOOP
        -- resolved per table inside the loop: pg_get_serial_sequence raises on a table
        -- without an "id" column, so it must never be evaluated before the join filters.
        seq := pg_catalog.pg_get_serial_sequence(r.tbl::text, 'id');
        CONTINUE WHEN seq IS NULL;
        CONTINUE WHEN COALESCE(pg_catalog.pg_sequence_last_value(seq::regclass), 0) < 900000000;
        EXECUTE format('SELECT max(id) FROM %s', r.tbl) INTO m;
        CONTINUE WHEN m >= 900000000;
        IF m IS NULL THEN
          PERFORM pg_catalog.setval(seq, 1, false);
        ELSE
          PERFORM pg_catalog.setval(seq, m, true);
        END IF;
      END LOOP;
    END $$`);
}
