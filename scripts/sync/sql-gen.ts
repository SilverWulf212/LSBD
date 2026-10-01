import type { SourceColumn, SourceTable } from "./types";

/**
 * T-SQL generators for the sync bridge (spec section 4.1). Everything here is SELECT-only
 * and reads with NOLOCK, except the PK point lookup (pkProbeSql). Pure string building: no
 * database access.
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

/** `[pk] IN (...)` with validated, literal-formatted keys. */
function pkInList(fn: string, t: SourceTable, keys: string[]): string {
  if (keys.length === 0) throw new Error(`${fn}: empty key list`);
  if (t.pk === null) throw new Error(`${fn}: keys given for a table without a PK`);
  const pk = t.pk;
  const pkCol = t.columns.find((c) => c.name === pk);
  if (!pkCol) throw new Error(`${fn}: PK column ${pk} not found in ${t.name}`);
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
  return `${q(pk)} IN (${list})`;
}

export function rowsSql(t: SourceTable, keys: string[] | "all"): string {
  const base = `SELECT *, ${rowHashExpr(t.columns)} AS __h FROM dbo.${q(t.name)} WITH (NOLOCK)`;
  if (keys === "all") return base;
  return `${base} WHERE ${pkInList("rowsSql", t, keys)}`;
}

/**
 * PK point lookup used to re-confirm delete candidates (ruling R38). No NOLOCK hint and no row
 * hash: an IN-list on the PK is answered by index seeks, which are not subject to the
 * allocation-order scan anomalies (rows skipped during a concurrent page split) that an
 * unordered NOLOCK key scan can hit. The bridge's READ UNCOMMITTED wrapper still applies, so it
 * never blocks on staff locks.
 */
export function pkProbeSql(t: SourceTable, keys: string[]): string {
  if (t.pk === null) throw new Error("pkProbeSql requires a PK");
  return `SELECT ${q(t.pk)} AS k FROM dbo.${q(t.name)} WHERE ${pkInList("pkProbeSql", t, keys)}`;
}
