import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { assertSeedAllowed } from "../../scripts/lib/seed-guard";

const ROOT = path.resolve(__dirname, "../..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("script hardening", () => {
  it("no file under scripts/ or src/ disables TLS verification", () => {
    const bad = [...walk(path.join(ROOT, "scripts")), ...walk(path.join(ROOT, "src"))].filter((f) =>
      fs.readFileSync(f, "utf8").includes("rejectUnauthorized: false"),
    );
    expect(bad).toEqual([]);
  });

  it("seed.ts has no default password", () => {
    expect(fs.readFileSync(path.join(ROOT, "scripts/seed.ts"), "utf8")).not.toContain("changeme");
  });

  it("sharp is not a dependency", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(pkg.dependencies ?? {}).not.toHaveProperty("sharp");
    expect(pkg.devDependencies ?? {}).not.toHaveProperty("sharp");
  });
});

describe("assertSeedAllowed", () => {
  it("requires INITIAL_ADMIN_PASSWORD", () => {
    expect(() => assertSeedAllowed({ password: undefined, existingUsers: 0, argv: [] })).toThrow(/INITIAL_ADMIN_PASSWORD/);
  });

  it("rejects a 13-character password", () => {
    expect(() => assertSeedAllowed({ password: "a".repeat(13), existingUsers: 0, argv: [] })).toThrow();
  });

  it("accepts a 14-character password on an empty users table", () => {
    const pw = "a".repeat(14);
    expect(assertSeedAllowed({ password: pw, existingUsers: 0, argv: [] })).toBe(pw);
  });

  it("refuses to wipe existing users without --wipe", () => {
    expect(() => assertSeedAllowed({ password: "a".repeat(14), existingUsers: 1, argv: [] })).toThrow(/--wipe/);
  });

  it("allows wiping existing users with --wipe", () => {
    const pw = "a".repeat(14);
    expect(assertSeedAllowed({ password: pw, existingUsers: 1, argv: ["--wipe"] })).toBe(pw);
  });
});
