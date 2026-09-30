import { describe, it, expect } from "vitest";
import { parseArgs, exitCodeFor, computeDrift, checkColumnSet, redact } from "../../scripts/sync/run";
import type { SourceTable } from "../../scripts/sync/types";

const col = (name: string, type: string, ordinal: number) => ({
  name,
  type,
  maxLength: 0,
  precision: 0,
  scale: 0,
  nullable: true,
  ordinal,
});

describe("parseArgs", () => {
  it("defaults to quick, all tables, transform on, guard on", () => {
    expect(parseArgs([])).toEqual({ mode: "quick", tables: undefined, transform: true, allowMassDelete: false });
  });
  it("parses every flag", () => {
    expect(parseArgs(["--mode", "full", "--tables", "A,B", "--no-transform", "--allow-mass-delete"])).toEqual({
      mode: "full",
      tables: ["A", "B"],
      transform: false,
      allowMassDelete: true,
    });
    expect(parseArgs(["--tables", "none"]).tables).toBe("none");
  });
  it("rejects bad input", () => {
    expect(() => parseArgs(["--mode", "fast"])).toThrow();
    expect(() => parseArgs(["--bogus"])).toThrow();
    expect(() => parseArgs(["--tables"])).toThrow();
    expect(() => parseArgs(["--tables", ","])).toThrow();
  });
});

describe("exitCodeFor", () => {
  it("maps statuses to exit codes", () => {
    expect(exitCodeFor("ok")).toBe(0);
    expect(exitCodeFor("skipped")).toBe(0);
    expect(exitCodeFor("failed")).toBe(1);
    expect(exitCodeFor("blocked")).toBe(2);
  });
});

describe("computeDrift", () => {
  const t: SourceTable = {
    name: "tblDenHyg",
    pk: "Key",
    rowCount: 0,
    columns: [col("Key", "int", 1), col("SSN", "nvarchar", 2), col("password", "nvarchar", 3), col("DateSince", "datetime", 4)],
  };
  const raw = [
    { column_name: "Key", data_type: "integer" },
    { column_name: "SSN", data_type: "text" },
    { column_name: "DateSince", data_type: "timestamp without time zone" },
    { column_name: "_row_hash", data_type: "text" },
    { column_name: "_synced_at", data_type: "timestamp with time zone" },
    { column_name: "_deleted_at", data_type: "timestamp with time zone" },
  ];
  it("no drift when raw matches (policy-dropped columns and bookkeeping ignored)", () => {
    expect(computeDrift(t, raw)).toEqual({ add: [], fatal: [], notes: [] });
  });
  it("new column -> add with mapped type", () => {
    const t2 = { ...t, columns: [...t.columns, col("New", "money", 5)] };
    expect(computeDrift(t2, raw)).toEqual({
      add: [{ name: "New", pgType: "numeric" }],
      fatal: [],
      notes: ["tblDenHyg.New added"],
    });
  });
  it("new policy-dropped column is not added", () => {
    const raw2 = raw.filter((r) => r.column_name !== "SSN");
    const t2: SourceTable = { ...t, name: "Users", columns: [col("Key", "int", 1), col("Password", "nvarchar", 2), col("DateSince", "datetime", 3)] };
    expect(computeDrift(t2, raw2).add).toEqual([]);
  });
  it("removed column and changed type are fatal", () => {
    const t2 = { ...t, columns: [col("Key", "int", 1), col("SSN", "nvarchar", 2), col("DateSince", "int", 4)] };
    const raw2 = [...raw, { column_name: "Gone", data_type: "text" }];
    const d = computeDrift(t2, raw2);
    expect(d.add).toEqual([]);
    expect(d.fatal.sort()).toEqual(["tblDenHyg.DateSince type changed", "tblDenHyg.Gone removed"]);
    expect(d.notes.length).toBe(2);
  });
  it("hmac column stays text even if the source type changes", () => {
    const t2 = { ...t, columns: [col("Key", "int", 1), col("SSN", "int", 2), col("DateSince", "datetime", 4)] };
    expect(computeDrift(t2, raw)).toEqual({ add: [], fatal: [], notes: [] });
  });
  it("no-PK tables ignore the _rowid surrogate", () => {
    const t2: SourceTable = { name: "Activity", pk: null, rowCount: 0, columns: [col("A", "nvarchar", 1)] };
    const raw2 = [
      { column_name: "_rowid", data_type: "bigint" },
      { column_name: "A", data_type: "text" },
      { column_name: "_row_hash", data_type: "text" },
    ];
    expect(computeDrift(t2, raw2)).toEqual({ add: [], fatal: [], notes: [] });
  });
});

describe("checkColumnSet", () => {
  const expected = new Set(["ID", "A", "__h"]);
  it("accepts the exact set", () => {
    expect(() => checkColumnSet("T", { ID: 1, A: null, __h: "x" }, expected)).not.toThrow();
  });
  it("rejects a missing or extra column", () => {
    expect(() => checkColumnSet("T", { ID: 1, __h: "x" }, expected)).toThrow(/column set mismatch/);
    expect(() => checkColumnSet("T", { ID: 1, A: 1, B: 2, __h: "x" }, expected)).toThrow(/column set mismatch/);
  });
});

describe("redact", () => {
  it("strips values from error messages", () => {
    expect(redact('invalid input syntax for type integer: "123-45-6789"')).toBe(
      'invalid input syntax for type integer: "<redacted>"',
    );
    expect(redact("Conversion failed when converting the nvarchar value 'abc' to data type int.")).toBe(
      "Conversion failed when converting the nvarchar value '<redacted>' to data type int.",
    );
    expect(redact('relation "lsbd_raw.x" does not exist')).toBe('relation "lsbd_raw.x" does not exist');
  });
});
