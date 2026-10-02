import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const rel = (p: string) => relative(root, p).split("\\").join("/");

describe("admin gates", () => {
  const actionsDir = join(root, "src/actions");
  const actionFiles = existsSync(actionsDir)
    ? walk(actionsDir).filter((f) => f.endsWith(".ts"))
    : [];

  it("finds action files", () => {
    expect(actionFiles.length).toBeGreaterThan(0);
  });

  it("every exported server action checks a capability", () => {
    const offenders: string[] = [];
    for (const file of actionFiles) {
      const parts = readFileSync(file, "utf8").split(/export async function /).slice(1);
      for (const part of parts) {
        const name = part.slice(0, part.indexOf("(")).trim();
        if (!part.includes("requireCapability(") && !part.includes("getSessionWith(")) {
          offenders.push(`${rel(file)}:${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no action file defines its own requireSession", () => {
    const offenders = actionFiles
      .filter((f) => readFileSync(f, "utf8").includes("async function requireSession"))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("every admin page calls requireCapability", () => {
    const pages = walk(join(root, "src/app/admin")).filter((f) => {
      const r = rel(f);
      return (
        r.endsWith("/page.tsx") &&
        !r.endsWith("admin/login/page.tsx") &&
        !r.endsWith("admin/403/page.tsx")
      );
    });
    expect(pages.length).toBeGreaterThan(0);
    const offenders = pages
      .filter((f) => !readFileSync(f, "utf8").includes("requireCapability("))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("the upload route checks a capability", () => {
    const src = readFileSync(join(root, "src/app/api/upload/route.ts"), "utf8");
    expect(src).toContain("getSessionWith(");
  });
});

describe("staff data gates", () => {
  const STAFF_PAGES: Record<string, string> = {
    "src/app/admin/licensees/page.tsx": 'requireCapability("licensees.read")',
    "src/app/admin/licensees/[key]/page.tsx": 'requireCapability("licensees.read")',
    "src/app/admin/permits/page.tsx": 'requireCapability("permits.read")',
    "src/app/admin/firms/page.tsx": 'requireCapability("permits.read")',
    "src/app/admin/firms/[id]/page.tsx": 'requireCapability("permits.read")',
  };
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const dataParts = () =>
    read("src/lib/staff-data.ts").split("export async function ").slice(1);

  it("each staff page gates on its capability before loading data", () => {
    for (const [file, gate] of Object.entries(STAFF_PAGES)) {
      expect(existsSync(join(root, file)), file).toBe(true);
      const src = read(file);
      expect(src, file).toContain(gate);
      const load = src.search(/await get(Licensee|Permit|Firm)/);
      expect(load, file).toBeGreaterThanOrEqual(0);
      expect(src.indexOf(gate), file).toBeLessThan(load);
      expect(src, file).toContain('dynamic = "force-dynamic"');
    }
  });

  it("every staff-data function checks a capability before opening the transaction", () => {
    const parts = dataParts();
    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      const gate = part.indexOf("requireCapability(");
      expect(gate, part.slice(0, 30)).toBeGreaterThanOrEqual(0);
      expect(gate).toBeLessThan(part.indexOf("withStaffRo("));
    }
  });

  it("each binding gates on the capability its screen needs", () => {
    const need: Record<string, string> = {
      getLicenseeList: "licensees.read", getLicenseeDetail: "licensees.read",
      getPermitList: "permits.read", getFirmList: "permits.read", getFirmDetail: "permits.read",
    };
    const parts = dataParts();
    for (const [name, cap] of Object.entries(need)) {
      const part = parts.find((p) => p.startsWith(name + "("));
      expect(part, name).toBeDefined();
      expect(part, name).toContain(`requireCapability("${cap}")`);
    }
  });

  it("no auth or db call sits inside a withStaffRo callback", () => {
    for (const part of dataParts()) {
      const inside = part.slice(part.indexOf("withStaffRo(") + "withStaffRo(".length);
      for (const bad of ["requireCapability(", "auth(", "db."]) {
        expect(inside, bad).not.toContain(bad);
      }
    }
  });

  it("section capabilities come from the session role", () => {
    const src = read("src/lib/staff-data.ts");
    expect(src).toContain('can(session.user.role, "pii.read")');
    expect(src).toContain('can(session.user.role, "discipline.read")');
  });

  it("staff pages never touch the db client or format dates themselves", () => {
    const files = ["licensees", "permits", "firms"]
      .flatMap((d) => walk(join(root, "src/app/admin", d)))
      .filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const bad of ["@/lib/db", "withStaffRo", "toLocaleDateString(", "toLocaleString("]) {
        expect(src, `${rel(f)} ${bad}`).not.toContain(bad);
      }
    }
  });

  it("the sidebar links staff screens by capability", () => {
    const src = read("src/components/admin/admin-sidebar.tsx");
    expect(src).toMatch(/href: "\/admin\/licensees".*capability: "licensees\.read"/);
  });

  it("the detail page is the printable fact sheet", () => {
    const src = read("src/app/admin/licensees/[key]/page.tsx");
    for (const s of ["PrintButton", "print:block", "break-inside-avoid", "notFound()", "NotLinked", "OddityBadges"]) {
      expect(src, s).toContain(s);
    }
  });

  it("the sidebar links permits and firms by capability", () => {
    const src = read("src/components/admin/admin-sidebar.tsx");
    expect(src).toMatch(/href: "\/admin\/permits".*capability: "permits\.read"/);
    expect(src).toMatch(/href: "\/admin\/firms".*capability: "permits\.read"/);
  });

  it("the firms page states the professional-association empty state", () => {
    const src = read("src/app/admin/firms/page.tsx");
    expect(src).toContain("No professional associations are on record");
    expect(src).toContain("associationCount");
  });

  it("the permits page offers the personal/office split and the two filters", () => {
    const src = read("src/app/admin/permits/page.tsx");
    for (const s of ['name="kind"', 'name="type"', 'name="level"', "NotLinked"]) {
      expect(src, s).toContain(s);
    }
  });
});
