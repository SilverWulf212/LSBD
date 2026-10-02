import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAFF_RO_TABLES } from "../../scripts/lib/staff-ro-tables";

const LIB = join(__dirname, "../../src/lib");
const files = readdirSync(LIB)
  .filter((n) => /^staff-.*\.ts$/.test(n))
  .map((n) => ({ name: n, text: readFileSync(join(LIB, n), "utf8") }));

// CR3/CR4: the grant list includes these, but no staff query may read them in this plan.
const NOT_IN_THIS_PLAN = ["education", "education_type"];
const ALLOWED = new Set<string>([
  ...STAFF_RO_TABLES.filter((t) => !NOT_IN_THIS_PLAN.includes(t)),
  "individual", // granted by column; PII columns are checked below
  "license_type", "license_status", "license_class", "address_type", // enum types
]);

describe("staff SQL guard", () => {
  it("finds staff modules", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("reads only relations granted to lsbd_staff_ro", () => {
    for (const f of files) {
      for (const m of f.text.matchAll(/\blsbd\.([a-z_]+)/g)) {
        expect(ALLOWED.has(m[1]), `${f.name} references lsbd.${m[1]}`).toBe(true);
      }
    }
  });

  it("never selects *", () => {
    for (const f of files) {
      expect(f.text, f.name).not.toMatch(/SELECT\s+\*/i);
      expect(f.text, f.name).not.toMatch(/\b[a-z][a-z0-9_]*\.\*/);
    }
  });

  it("never names a forbidden relation or column", () => {
    const forbidden = [
      "licensee_pii", "person_practice_stats", "lsbd_raw", "transactions", "transaction_splits",
      "renewals", "renewal_", "complaint", "logins", "lsbd.users",
      "pllc_number", "pa_number",
    ];
    for (const f of files) {
      for (const w of forbidden) expect(f.text, `${f.name} mentions ${w}`).not.toContain(w);
      expect(f.text, f.name).not.toMatch(/\blsbd\.education(_type)?\b/);
    }
  });

  it("never selects PII columns of lsbd.individual", () => {
    for (const f of files) {
      if (/\blsbd\.individual\b(?!_)/.test(f.text)) {
        expect(f.text, f.name).not.toMatch(/\b(ssn|dob|sex|race)\b/);
      }
    }
  });

  it("goes through withStaffRo only", () => {
    for (const f of files) {
      for (const bad of ['from "@/lib/db"', 'from "./db"', "db.execute", "db.select", "db.$client"]) {
        expect(f.text, `${f.name} contains ${bad}`).not.toContain(bad);
      }
      if (f.name !== "staff-data.ts") expect(f.text, f.name).not.toContain("withStaffRo");
    }
  });
});
