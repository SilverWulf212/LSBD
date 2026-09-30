import { describe, it, expect } from "vitest";
import { splitStatements, buildBootstrapSql } from "../../scripts/sync/bootstrap-raw";
import type { SourceTable } from "../../scripts/sync/types";

const t = (name: string): SourceTable => ({
  name,
  pk: "ID",
  rowCount: 0,
  columns: [{ name: "ID", type: "int", maxLength: 0, precision: 0, scale: 0, nullable: false, ordinal: 1 }],
});

describe("splitStatements", () => {
  it("splits on semicolons outside quotes", () => {
    expect(splitStatements("A;\nB;\n")).toEqual(["A", "B"]);
  });
  it("does not split inside quoted identifiers or strings", () => {
    const s = `CREATE TABLE x."a;\nb" (c int);\nSELECT 'it''s; ok';`;
    expect(splitStatements(s)).toEqual([`CREATE TABLE x."a;\nb" (c int)`, `SELECT 'it''s; ok'`]);
  });
  it("rejects an unterminated quote", () => {
    expect(() => splitStatements(`SELECT "x;`)).toThrow();
  });
});

describe("buildBootstrapSql", () => {
  it("skips excluded tables, sorts by name, bookkeeping first", () => {
    const { sql, tableCount } = buildBootstrapSql([t("Zed"), t("VSAuth"), t("VsCapture"), t("Alpha")]);
    expect(tableCount).toBe(2);
    expect(sql.indexOf("CREATE SCHEMA IF NOT EXISTS lsbd_raw")).toBe(0);
    expect(sql.indexOf('lsbd_raw."Alpha"')).toBeLessThan(sql.indexOf('lsbd_raw."Zed"'));
    expect(sql).not.toContain("VSAuth");
  });
});
