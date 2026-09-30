import type { SourceColumn, SourceTable } from "./types";

/**
 * T-SQL generators for the sync bridge (spec section 4.1). Everything here is SELECT-only
 * and reads with NOLOCK. Pure string building: no database access.
 */

// U+2400, written as NCHAR so it survives any transport encoding.
const NULL_SENTINEL = "NCHAR(9216)";
const SEP = "NCHAR(31)";
const INT_PK_TYPES = new Set(["int", "smallint", "tinyint"]);

/** `[name]` with any `]` doubled. */
function q(name: string): string {
  return `[${name.replace(/]/g, "]]")}]`;
}

/** `N'...'` literal with `'` doubled. */
function nlit(s: string): string {
  return `N'${s.replace(/'/g, "''")}'`;
}

/** Canonical text form of one column (spec table "Row hash canonicalisation"). */
function textForm(c: SourceColumn): string {
  const n = q(c.name);
  switch (c.type.toLowerCase()) {
    case "datetime":
    case "smalldatetime":
      return `CONVERT(nvarchar(30), ${n}, 126)`;
    case "float":
      return `CONVERT(nvarchar(30), ${n}, 3)`;
    case "money":
      // Style 2 keeps all 4 decimal places; style 0 would round to 2 and hide small edits.
      return `CONVERT(nvarchar(40), ${n}, 2)`;
    case "decimal":
      return `CONVERT(nvarchar(40), ${n})`;
    case "ntext":
      return `CAST(${n} AS nvarchar(max))`;
    case "image":
      return `CONVERT(nvarchar(max), CAST(${n} AS varbinary(max)), 2)`;
    case "uniqueidentifier":
      return `CONVERT(nvarchar(36), ${n})`;
    case "bit":
    case "int":
    case "smallint":
    case "tinyint":
      return `CONVERT(nvarchar(20), ${n})`;
    case "nvarchar":
    case "nchar":
      return n;
    case "varchar":
    case "char":
      // ISNULL takes the type of its first argument. A varchar column would turn the
      // unicode NULL sentinel into '?', which could collide with a real '?' value.
      return `CAST(${n} AS nvarchar(max))`;
    default:
      throw new Error(`Unsupported MSSQL type: ${c.type}`);
  }
}

/**
 * SHA-256 (hex, char(64)) of the row's canonical text. Every column is ISNULL-wrapped so
 * NULL, '' and ' ' all hash differently. The concatenation starts from nvarchar(max) so a
 * wide row is never silently truncated at 4000 characters.
 */
export function rowHashExpr(cols: SourceColumn[]): string {
  if (cols.length === 0) throw new Error("rowHashExpr: no columns");
  const parts = [...cols]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((c) => `ISNULL(${textForm(c)}, ${NULL_SENTINEL})`);
  const concat = `CAST(N'' AS nvarchar(max)) + ${parts.join(` + ${SEP} + `)}`;
  return `CONVERT(char(64), HASHBYTES('SHA2_256', ${concat}), 2)`;
}

/** One statement: per-table row count and checksum aggregate, joined with UNION ALL. */
export function fingerprintSql(tables: SourceTable[]): string {
  if (tables.length === 0) throw new Error("fingerprintSql: no tables");
  return tables
    .map(
      (t) =>
        `SELECT ${nlit(t.name)} AS t, COUNT_BIG(*) AS n, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS fp ` +
        `FROM dbo.${q(t.name)} WITH (NOLOCK)`,
    )
    .join(" UNION ALL ");
}

export function keysSql(t: SourceTable): string {
  if (t.pk === null) throw new Error("keysSql requires a PK");
  return `SELECT ${q(t.pk)} AS k, ${rowHashExpr(t.columns)} AS h FROM dbo.${q(t.name)} WITH (NOLOCK)`;
}

export function rowsSql(t: SourceTable, keys: string[] | "all"): string {
  const base = `SELECT *, ${rowHashExpr(t.columns)} AS __h FROM dbo.${q(t.name)} WITH (NOLOCK)`;
  if (keys === "all") return base;
  if (keys.length === 0) throw new Error("rowsSql: empty key list");
  if (t.pk === null) throw new Error("rowsSql: keys given for a table without a PK");
  const pk = t.pk;
  const pkCol = t.columns.find((c) => c.name === pk);
  if (!pkCol) throw new Error(`rowsSql: PK column ${pk} not found in ${t.name}`);
  const isInt = INT_PK_TYPES.has(pkCol.type.toLowerCase());
  const list = keys
    .map((k) => {
      if (isInt) {
        if (!/^-?\d+$/.test(k)) throw new Error("Invalid integer key");
        return k;
      }
      return nlit(k);
    })
    .join(", ");
  return `${base} WHERE ${q(pk)} IN (${list})`;
}
