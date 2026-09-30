export interface SourceColumn {
  name: string;
  type: string;
  maxLength: number;
  precision: number;
  scale: number;
  nullable: boolean;
  ordinal: number;
}

export interface SourceTable {
  name: string;
  /** Single PK column name; null means the table has no PK. */
  pk: string | null;
  columns: SourceColumn[];
  rowCount: number;
}

export type ColumnAction = "hmac" | "drop";
export type TablePolicy = Record<string, ColumnAction>;
export type KeyHash = { k: string; h: string };
