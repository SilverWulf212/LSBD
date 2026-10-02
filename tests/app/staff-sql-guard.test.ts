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

const FORBIDDEN = [
  "licensee_pii", "person_practice_stats", "lsbd_raw", "transactions", "transaction_splits",
  "renewals", "renewal_", "complaint", "logins", "lsbd.users",
  "pllc_number", "pa_number",
];

/** Every rule the staff SQL must obey, as a list of violations (empty = clean). */
function violations(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\blsbd\.([a-z_]+)/g)) {
    if (!ALLOWED.has(m[1])) out.push(`references lsbd.${m[1]}`);
  }
  if (/SELECT\s+(DISTINCT\s+)?\*/i.test(text)) out.push("selects *");
  if (/\b[a-z][a-z0-9_]*\.\*/i.test(text)) out.push("selects alias.*");
  for (const w of FORBIDDEN) if (text.includes(w)) out.push(`mentions ${w}`);
  if (/\blsbd\.education(_type)?\b/.test(text)) out.push("reads lsbd.education");
  if (/\blsbd\.individual\b(?!_)/.test(text) && /\b(ssn|dob|sex|race)\b/i.test(text)) {
    out.push("selects PII columns of lsbd.individual");
  }
  return out;
}

describe("staff SQL guard", () => {
  it("finds staff modules", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every staff module is clean", () => {
    for (const f of files) expect(violations(f.text), f.name).toEqual([]);
  });

  it("flags what it is meant to flag", () => {
    const bad: [string, string][] = [
      ["SELECT * FROM lsbd.licensee_pii", "selects *"],
      ["SELECT DISTINCT * FROM lsbd.person", "selects *"],
      ["SELECT P.* FROM lsbd.person P", "selects alias.*"],
      ["SELECT a FROM lsbd.education", "reads lsbd.education"],
      ["SELECT pllc_number FROM lsbd.license", "mentions pllc_number"],
      ["select i.ssn from lsbd.individual i", "selects PII columns of lsbd.individual"],
    ];
    for (const [sql, want] of bad) expect(violations(sql), sql).toContain(want);
    expect(violations("SELECT p.id FROM lsbd.person p")).toEqual([]);
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
