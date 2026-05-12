// Legacy LSBD tables — translated from MSSQL LSBDDB to Postgres.
// All tables live in the "lsbd" Postgres schema (created via pgSchema in each
// slice file). This keeps them cleanly separated from the website CMS tables
// in `public`.
//
// Slices:
//   - core.ts        people / license / discipline / complaints
//   - operations.ts  permits / renewals / transactions / inspections / education
//   - reference.ts   geography / address / office / lookups / audit / misc

export * from "./core";
export * from "./operations";
export * from "./reference";
