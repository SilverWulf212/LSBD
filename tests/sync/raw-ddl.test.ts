import { describe, it, expect } from "vitest";
import { pgTypeFor } from "../../scripts/sync/type-map";
import { rawTableDdl, bookkeepingDdl } from "../../scripts/sync/raw-ddl";
import type { SourceColumn, SourceTable } from "../../scripts/sync/types";

function col(name: string, type: string, extra: Partial<SourceColumn> = {}): SourceColumn {
  return { name, type, maxLength: 0, precision: 0, scale: 0, nullable: true, ordinal: 1, ...extra };
}

describe("pgTypeFor", () => {
  const cases: Array<[string, string]> = [
    ["nvarchar", "text"],
    ["varchar", "text"],
    ["nchar", "text"],
    ["char", "text"],
    ["ntext", "text"],
    ["int", "integer"],
    ["smallint", "smallint"],
    ["tinyint", "smallint"],
    ["bit", "boolean"],
    ["datetime", "timestamp"],
    ["smalldatetime", "timestamp"],
    ["money", "numeric"],
    ["decimal", "numeric"],
    ["float", "double precision"],
    ["uniqueidentifier", "uuid"],
    ["image", "bytea"],
  ];
  it.each(cases)("maps %s -> %s", (src, pg) => {
    expect(pgTypeFor(col("c", src))).toBe(pg);
  });
  it("throws on an unknown type", () => {
    expect(() => pgTypeFor(col("c", "xml"))).toThrow("Unsupported MSSQL type: xml");
  });
});

describe("rawTableDdl", () => {
  const t: SourceTable = {
    name: "tblDenHyg",
    pk: "Key",
    rowCount: 3,
    columns: [
      col("Key", "int", { nullable: false, ordinal: 1 }),
      col("LastName", "nvarchar", { ordinal: 2 }),
      col("SSN", "nvarchar", { ordinal: 3 }),
      col("password", "nvarchar", { ordinal: 4 }),
    ],
  };
  const ddl = rawTableDdl(t, { SSN: "hmac", password: "drop" });

  it("creates the quoted table with PK and hmac column as text", () => {
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS lsbd_raw."tblDenHyg"');
    expect(ddl).toContain('"Key" integer NOT NULL PRIMARY KEY');
    expect(ddl).toContain('"LastName" text');
    expect(ddl).toContain('"SSN" text');
  });
  it("adds sync bookkeeping columns", () => {
    expect(ddl).toContain("_row_hash text NOT NULL");
    expect(ddl).toContain("_synced_at timestamptz NOT NULL DEFAULT now()");
    expect(ddl).toContain("_deleted_at timestamptz");
  });
  it("omits dropped columns", () => {
    expect(ddl).not.toContain('"password"');
  });
  it("locks the table down", () => {
    expect(ddl).toContain('REVOKE ALL ON lsbd_raw."tblDenHyg" FROM anon, authenticated');
    expect(ddl).toContain('ALTER TABLE lsbd_raw."tblDenHyg" ENABLE ROW LEVEL SECURITY');
  });
  it("uses a surrogate _rowid for a no-PK table", () => {
    const np: SourceTable = {
      name: "tblDates",
      pk: null,
      rowCount: 1,
      columns: [col("d", "datetime")],
    };
    const d = rawTableDdl(np, {});
    expect(d).toContain("_rowid bigserial PRIMARY KEY");
    expect(d).not.toContain("NOT NULL PRIMARY KEY");
  });
  it("keeps hmac columns nullable even if the source is NOT NULL", () => {
    const h: SourceTable = {
      name: "x",
      pk: null,
      rowCount: 0,
      columns: [col("SSN", "nvarchar", { nullable: false })],
    };
    const d = rawTableDdl(h, { SSN: "hmac" });
    expect(d).toContain('"SSN" text,');
    expect(d).not.toContain('"SSN" text NOT NULL');
  });
  it("escapes embedded double quotes in identifiers", () => {
    const q: SourceTable = {
      name: 'we"ird',
      pk: null,
      rowCount: 0,
      columns: [col('a"b', "int")],
    };
    const d = rawTableDdl(q, {});
    expect(d).toContain('lsbd_raw."we""ird"');
    expect(d).toContain('"a""b" integer');
  });
});

describe("bookkeepingDdl", () => {
  const ddl = bookkeepingDdl();
  it("creates the schema once", () => {
    expect(ddl.match(/CREATE SCHEMA IF NOT EXISTS lsbd_raw;/g)).toHaveLength(1);
  });
  it("creates _sync_runs with the spec columns", () => {
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS lsbd_raw._sync_runs");
    for (const c of [
      "id bigserial PRIMARY KEY",
      "started_at timestamptz NOT NULL DEFAULT now()",
      "finished_at timestamptz",
      "mode text NOT NULL",
      "status text NOT NULL",
      "tables_changed text[]",
      "inserted integer",
      "updated integer",
      "deleted integer",
      "orphans_skipped integer",
      "error text",
      "blocked_tables text[]",
      "schema_drift text[]",
    ]) {
      expect(ddl).toContain(c);
    }
  });
  it("creates _sync_tables with the spec columns", () => {
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS lsbd_raw._sync_tables");
    for (const c of [
      "table_name text PRIMARY KEY",
      "source_count bigint",
      "source_fingerprint bigint",
      "raw_live_count bigint",
      "last_changed_at timestamptz",
      "last_synced_at timestamptz",
    ]) {
      expect(ddl).toContain(c);
    }
  });
  it("locks both tables down", () => {
    for (const t of ["_sync_runs", "_sync_tables"]) {
      expect(ddl).toContain(`REVOKE ALL ON lsbd_raw.${t} FROM anon, authenticated`);
      expect(ddl).toContain(`ALTER TABLE lsbd_raw.${t} ENABLE ROW LEVEL SECURITY`);
    }
  });
});
