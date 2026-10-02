import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RULEMAKING_HISTORY,
  RULEMAKING_YEARLY_REPORTS,
  SITE_DOCUMENTS,
} from "../../src/lib/lsbd-org-documents";

const root = path.resolve(__dirname, "../..");
const inPublic = (href: string) => fs.existsSync(path.join(root, "public", href));

describe("documents carried over from lsbd.org", () => {
  it("every page link points at a file in public/documents", () => {
    const hrefs = [
      ...Object.values(SITE_DOCUMENTS).map((d) => d.href),
      ...RULEMAKING_YEARLY_REPORTS.map((r) => r.href),
      ...RULEMAKING_HISTORY.flatMap((r) => r.documents.map((d) => d.href)),
    ];
    expect(hrefs.length).toBeGreaterThan(40);
    expect(hrefs.filter((h) => !h.startsWith("/documents/") || !inPublic(h))).toEqual([]);
  });

  it("every file the import SQL references exists, and none is a placeholder", () => {
    const sql = fs.readFileSync(path.join(root, "drizzle/0010_real_site_documents.sql"), "utf8");
    const hrefs = [...sql.matchAll(/'(\/documents\/[^'%]+)'/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(170);
    expect(hrefs.filter((h) => !inPublic(h))).toEqual([]);
    expect(sql).not.toMatch(/'#'/);
  });

  it("no file in public/documents is left unreferenced", () => {
    const sql = fs.readFileSync(path.join(root, "drizzle/0010_real_site_documents.sql"), "utf8");
    const ts = fs.readFileSync(path.join(root, "src/lib/lsbd-org-documents.ts"), "utf8");
    const all: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else all.push("/" + path.relative(path.join(root, "public"), p).split(path.sep).join("/"));
      }
    };
    walk(path.join(root, "public/documents"));
    expect(all.filter((h) => !sql.includes(`'${h}'`) && !ts.includes(`"${h}"`))).toEqual([]);
  });
});
