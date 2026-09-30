import { describe, it, expect } from "vitest";
import { EXCLUDED_TABLES, COLUMN_POLICY, policyFor, applyPolicy } from "../../scripts/sync/policy";
import { hmacSsn } from "../../scripts/lib/pii";

const key = Buffer.from("test-key");

describe("EXCLUDED_TABLES", () => {
  it("contains exactly the three excluded source tables", () => {
    expect([...EXCLUDED_TABLES].sort()).toEqual(["VSAuth", "VsCapture", "dtproperties"]);
  });
});

describe("policyFor", () => {
  it("returns an empty policy for tables without one", () => {
    expect(policyFor("Office")).toEqual({});
  });
  it("returns the configured policy", () => {
    expect(policyFor("tblDenHyg")).toEqual({ SSN: "hmac", password: "drop" });
    expect(policyFor("Individual")).toEqual({ SSN: "hmac" });
    expect(policyFor("tblRndDentists")).toEqual({ SSN: "hmac" });
    expect(policyFor("tblRndHygienists")).toEqual({ SSN: "hmac" });
    expect(policyFor("Users")).toEqual({ Password: "drop" });
  });
  it("is case-sensitive on table names", () => {
    expect(policyFor("tbldenhyg")).toEqual({});
  });
  it("does not expose Object.prototype keys as policies", () => {
    expect(policyFor("constructor")).toEqual({});
    expect(policyFor("toString")).toEqual({});
  });
  it("covers exactly the five policy tables", () => {
    expect(Object.keys(COLUMN_POLICY).sort()).toEqual([
      "Individual",
      "Users",
      "tblDenHyg",
      "tblRndDentists",
      "tblRndHygienists",
    ]);
  });
});

describe("applyPolicy", () => {
  it("hmacs SSN and drops password on tblDenHyg", () => {
    const out = applyPolicy("tblDenHyg", { Key: 1, SSN: "123-45-6789", password: "x", LastName: "A" }, key);
    expect(out.LastName).toBe("A");
    expect(out.Key).toBe(1);
    expect(out.SSN).toBe(hmacSsn(key, "123456789"));
    expect("password" in out).toBe(false);
  });
  it("drops Users.Password", () => {
    const out = applyPolicy("Users", { Password: "p", UserName: "u" }, key);
    expect("Password" in out).toBe(false);
    expect(out.UserName).toBe("u");
  });
  it("sets SSN to null when it does not normalise to 9 digits", () => {
    expect(applyPolicy("Individual", { SSN: "12345" }, key).SSN).toBeNull();
    expect(applyPolicy("Individual", { SSN: null }, key).SSN).toBeNull();
    expect(applyPolicy("Individual", { SSN: "" }, key).SSN).toBeNull();
  });
  it("never mutates its input and returns a new object", () => {
    const row = { SSN: "123-45-6789", password: "x" };
    const snapshot = { ...row };
    const out = applyPolicy("tblDenHyg", row, key);
    expect(row).toEqual(snapshot);
    expect(out).not.toBe(row);
  });
  it("returns a copy for tables with no policy", () => {
    const row = { a: 1 };
    const out = applyPolicy("Office", row, key);
    expect(out).toEqual(row);
    expect(out).not.toBe(row);
  });
  it("ignores policy columns absent from the row", () => {
    const out = applyPolicy("tblDenHyg", { LastName: "A" }, key);
    expect(out).toEqual({ LastName: "A" });
  });
  it("fails closed when a row key case-mismatches a policy column", () => {
    expect(() => applyPolicy("tblDenHyg", { ssn: "123-45-6789" }, key)).toThrow(
      "applyPolicy: column ssn on tblDenHyg case-mismatches policy column SSN",
    );
    expect(() => applyPolicy("tblDenHyg", { Password: "x" }, key)).toThrow(
      "applyPolicy: column Password on tblDenHyg case-mismatches policy column password",
    );
    expect(() => applyPolicy("Users", { PASSWORD: "x" }, key)).toThrow(
      "applyPolicy: column PASSWORD on Users case-mismatches policy column Password",
    );
  });
  it("still works with exact-case columns alongside other columns", () => {
    const out = applyPolicy("Users", { Password: "p", passwordHint: "h" }, key);
    expect(out).toEqual({ passwordHint: "h" });
  });
});
