import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findTransactionControl } from "../../scripts/apply-sql";

describe("findTransactionControl", () => {
  it.each([
    "drizzle/0002_rls.sql",
    "drizzle/0005_public_cms_lockdown.sql",
    "drizzle/0006_db_roles.sql",
    "drizzle/0007_public_view_owner_rights.sql",
  ])("finds none in %s", (file) => {
    expect(findTransactionControl(readFileSync(file, "utf8"))).toBeNull();
  });

  it.each([
    ["BEGIN;\nSELECT 1;\nCOMMIT;", "BEGIN;"],
    ["  start transaction;", "start transaction;"],
    ["select 1;\nROLLBACK ;", "ROLLBACK ;"],
    ["BEGIN TRANSACTION;", "BEGIN TRANSACTION;"],
    ["begin work;", "begin work;"],
    ["select 1;\r\nCOMMIT WORK;\r\n", "COMMIT WORK;"],
    ["select 1;\nrollback transaction;", "rollback transaction;"],
  ])("refuses %j", (sql, found) => {
    expect(findTransactionControl(sql)).toBe(found);
  });

  it("does not take a PL/pgSQL block's BEGIN for a transaction", () => {
    expect(findTransactionControl("DO $$\nBEGIN\n  PERFORM 1;\nEND $$;")).toBeNull();
    expect(findTransactionControl("DO $$\nDECLARE n int;\nBEGIN\n  BEGIN\n    n := 1;\n  END;\nEND $$;")).toBeNull();
  });

  it("ignores a statement that is commented out", () => {
    expect(findTransactionControl("-- BEGIN;\nSELECT 1;")).toBeNull();
  });
});
