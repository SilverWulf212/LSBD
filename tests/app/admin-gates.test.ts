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
