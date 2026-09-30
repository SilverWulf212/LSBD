import type { SourceColumn } from "./types";

// MSSQL -> Postgres (spec section 4.1).
const MAP: Record<string, string> = {
  nvarchar: "text",
  varchar: "text",
  nchar: "text",
  char: "text",
  ntext: "text",
  int: "integer",
  smallint: "smallint",
  tinyint: "smallint",
  bit: "boolean",
  datetime: "timestamp",
  smalldatetime: "timestamp",
  money: "numeric",
  decimal: "numeric",
  float: "double precision",
  uniqueidentifier: "uuid",
  image: "bytea",
};

export function pgTypeFor(c: SourceColumn): string {
  const t = MAP[c.type.toLowerCase()];
  if (!t) throw new Error(`Unsupported MSSQL type: ${c.type}`);
  return t;
}
