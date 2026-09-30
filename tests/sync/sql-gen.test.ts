import { describe, it, expect } from "vitest";
import { rowHashExpr, fingerprintSql, keysSql, rowsSql } from "../../scripts/sync/sql-gen";
import type { SourceColumn, SourceTable } from "../../scripts/sync/types";

const NUL = "NCHAR(9216)";

function col(name: string, type: string, ordinal = 1): SourceColumn {
  return { name, type, maxLength: 0, precision: 0, scale: 0, nullable: true, ordinal };
}
function tbl(name: string, pk: string | null, cols: SourceColumn[]): SourceTable {
  return { name, pk, columns: cols, rowCount: 0 };
}

describe("rowHashExpr", () => {
  const cols = [
    col("a", "nvarchar", 1),
    col("b", "datetime", 2),
    col("c", "ntext", 3),
    col("d", "image", 4),
    col("e", "float", 5),
  ];
  const expr = rowHashExpr(cols);

  it("uses the canonical text form per type", () => {
    expect(expr).toContain("CONVERT(nvarchar(30), [b], 126)");
    expect(expr).toContain("CAST([c] AS nvarchar(max))");
    expect(expr).toContain("CONVERT(nvarchar(max), CAST([d] AS varbinary(max)), 2)");
    expect(expr).toContain("CONVERT(nvarchar(30), [e], 3)");
  });
  it("joins with NCHAR(31) and hashes with SHA2_256 to char(64)", () => {
    expect(expr).toContain("NCHAR(31)");
    expect(expr).toContain("HASHBYTES('SHA2_256'");
    expect(expr.startsWith("CONVERT(char(64), HASHBYTES('SHA2_256'")).toBe(true);
    expect(expr.endsWith(", 2)")).toBe(true);
  });
  it("wraps every column in ISNULL with the NULL sentinel so NULL differs from empty string", () => {
    expect((expr.match(/ISNULL\(/g) ?? []).length).toBe(cols.length);
    expect(expr).toContain(`ISNULL([a], ${NUL})`);
    expect(expr.split(NUL).length - 1).toBe(cols.length);
  });
  it("orders columns by ordinal", () => {
    const e = rowHashExpr([col("z", "int", 2), col("y", "int", 1)]);
    expect(e.indexOf("[y]")).toBeLessThan(e.indexOf("[z]"));
  });
  it("maps the remaining types", () => {
    const e = rowHashExpr([
      col("m", "money"),
      col("d", "decimal"),
      col("g", "uniqueidentifier"),
      col("bt", "bit"),
      col("i", "int"),
      col("si", "smallint"),
      col("ti", "tinyint"),
      col("sd", "smalldatetime"),
    ]);
    expect(e).toContain("CONVERT(nvarchar(40), [m], 2)");
    expect(e).toContain("CONVERT(nvarchar(40), [d])");
    expect(e).toContain("CONVERT(nvarchar(36), [g])");
    for (const c of ["bt", "i", "si", "ti"]) expect(e).toContain(`CONVERT(nvarchar(20), [${c}])`);
    expect(e).toContain("CONVERT(nvarchar(30), [sd], 126)");
  });
  it("uses style 2 for money (4dp) but not for decimal", () => {
    const m = rowHashExpr([col("m", "money")]);
    const d = rowHashExpr([col("d", "decimal")]);
    expect(m).toContain("CONVERT(nvarchar(40), [m], 2)");
    expect(d).toContain("CONVERT(nvarchar(40), [d])");
    expect(d).not.toContain("[d], 2)");
  });
  it("uses the encoding-proof NCHAR(9216) sentinel, never a literal U+2400", () => {
    expect(expr).toContain("NCHAR(9216)");
    expect(expr).not.toContain("␀");
  });
  it("widens varchar/char so the unicode sentinel is not mangled to '?'", () => {
    const e = rowHashExpr([col("v", "varchar"), col("c", "char"), col("n", "nchar")]);
    expect(e).toContain(`ISNULL(CAST([v] AS nvarchar(max)), ${NUL})`);
    expect(e).toContain(`ISNULL(CAST([c] AS nvarchar(max)), ${NUL})`);
    expect(e).toContain(`ISNULL([n], ${NUL})`);
  });
  it("starts the concatenation as nvarchar(max) so long rows are not truncated", () => {
    expect(expr).toContain("CAST(N'' AS nvarchar(max))");
  });
  it("doubles ] in identifiers", () => {
    expect(rowHashExpr([col("we]ird", "int")])).toContain("[we]]ird]");
  });
  it("throws on unsupported types and on empty column lists", () => {
    expect(() => rowHashExpr([col("x", "xml")])).toThrow(/Unsupported MSSQL type/);
    expect(() => rowHashExpr([])).toThrow();
  });
});

describe("fingerprintSql", () => {
  it("emits one UNION ALL statement", () => {
    const sql = fingerprintSql([tbl("A", "id", []), tbl("B", null, [])]);
    expect(sql).toBe(
      "SELECT N'A' AS t, COUNT_BIG(*) AS n, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS fp FROM dbo.[A] WITH (NOLOCK)" +
        " UNION ALL " +
        "SELECT N'B' AS t, COUNT_BIG(*) AS n, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS fp FROM dbo.[B] WITH (NOLOCK)",
    );
    expect(sql).not.toContain(";");
  });
  it("doubles quotes in literals and brackets in identifiers", () => {
    const sql = fingerprintSql([tbl("O'B]x", null, [])]);
    expect(sql).toContain("N'O''B]x' AS t");
    expect(sql).toContain("dbo.[O'B]]x]");
  });
  it("rejects an empty table list", () => {
    expect(() => fingerprintSql([])).toThrow();
  });
});

describe("keysSql", () => {
  const t = tbl("Office", "OfficeID", [col("OfficeID", "int"), col("Name", "nvarchar", 2)]);
  it("selects pk and row hash", () => {
    const sql = keysSql(t);
    expect(sql.startsWith("SELECT [OfficeID] AS k, CONVERT(char(64), HASHBYTES(")).toBe(true);
    expect(sql).toContain(" AS h FROM dbo.[Office] WITH (NOLOCK)");
  });
  it("throws when there is no PK", () => {
    expect(() => keysSql(tbl("X", null, [col("a", "int")]))).toThrow("keysSql requires a PK");
  });
});

describe("rowsSql", () => {
  const strT = tbl("Person", "Code", [col("Code", "nvarchar"), col("Name", "nvarchar", 2)]);
  const intT = tbl("Office", "OfficeID", [col("OfficeID", "int"), col("Name", "nvarchar", 2)]);

  it("selects all rows with __h when keys is 'all'", () => {
    const sql = rowsSql(strT, "all");
    expect(sql.startsWith("SELECT *, CONVERT(char(64), HASHBYTES(")).toBe(true);
    expect(sql).toContain(" AS __h FROM dbo.[Person] WITH (NOLOCK)");
    expect(sql).not.toContain("WHERE");
  });
  it("doubles single quotes in string keys", () => {
    const sql = rowsSql(strT, ["O'Brien"]);
    expect(sql).toContain("N'O''Brien'");
    expect(sql).toContain("WHERE [Code] IN (N'O''Brien')");
  });
  it("preserves trailing spaces in string keys", () => {
    expect(rowsSql(strT, ["ab  "])).toContain("N'ab  '");
  });
  it("emits integer keys bare", () => {
    expect(rowsSql(intT, ["12"])).toContain("IN (12)");
    expect(rowsSql(intT, ["12", "-3"])).toContain("IN (12, -3)");
  });
  it.each(["smallint", "tinyint"])("treats %s PKs as integers", (ty) => {
    const t = tbl("T", "id", [col("id", ty)]);
    expect(rowsSql(t, ["7"])).toContain("IN (7)");
    expect(() => rowsSql(t, ["x"])).toThrow("Invalid integer key");
  });
  it("rejects injection attempts in integer keys", () => {
    expect(() => rowsSql(intT, ["12; DROP"])).toThrow("Invalid integer key");
    expect(() => rowsSql(intT, [""])).toThrow("Invalid integer key");
    expect(() => rowsSql(intT, ["1.5"])).toThrow("Invalid integer key");
    expect(() => rowsSql(intT, ["12\n"])).toThrow("Invalid integer key");
  });
  it("emits uniqueidentifier keys as N'' literals", () => {
    const t = tbl("G", "id", [col("id", "uniqueidentifier")]);
    expect(rowsSql(t, ["AB-1"])).toContain("IN (N'AB-1')");
  });
  it("throws on an empty key list", () => {
    expect(() => rowsSql(intT, [])).toThrow("rowsSql: empty key list");
  });
  it("throws when keys are given for a table without a PK", () => {
    expect(() => rowsSql(tbl("N", null, [col("a", "int")]), ["1"])).toThrow();
  });
  it("allows 'all' for a table without a PK", () => {
    expect(rowsSql(tbl("N", null, [col("a", "int")]), "all")).toContain("FROM dbo.[N] WITH (NOLOCK)");
  });
  it("throws when the PK column is not in the column list", () => {
    expect(() => rowsSql(tbl("N", "zz", [col("a", "int")]), ["1"])).toThrow();
  });
});
