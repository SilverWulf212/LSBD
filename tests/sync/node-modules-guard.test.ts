import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// M9 (ruling R42): when SYSTEM runs node from C:\ProgramData\lsbd-sync\app, a module missing
// from app\node_modules is looked up in C:\ProgramData\node_modules and C:\node_modules, which
// Users can create by default. install-task.ps1 pre-creates both as empty, Administrators-owned,
// SYSTEM + Administrators-only directories (Protect-NodeModulesDir). This test runs the same
// function against temp paths. Needs Windows and an elevated session (setting the owner to
// Administrators requires the elevated token).
//
// Skipped on CI: the hosted Windows runner is elevated but its ACLs do not read back the way
// the LSBD host's do (owner null, no ACEs), and the guard only ever runs on that host.

const HELPER = path.resolve(__dirname, "../../scripts/sync/node-modules-guard.ps1");

function ps(script: string): { code: number; out: string; err: string } {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
  });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

const elevated =
  process.platform === "win32" &&
  !process.env.CI &&
  ps("([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators')").out.trim() ===
    "True";

const q = (p: string) => `'${p.replace(/'/g, "''")}'`;

function aclOf(p: string): { owner: string; protectedAcl: boolean; aces: string[] } {
  const r = ps(
    `$a = Get-Acl -LiteralPath ${q(p)}; ` +
      `$sid = [Security.Principal.SecurityIdentifier]; ` +
      `$o = (New-Object Security.Principal.NTAccount($a.Owner)).Translate($sid).Value; ` +
      `$aces = @($a.Access | ForEach-Object { $_.IdentityReference.Translate($sid).Value + '|' + $_.FileSystemRights + '|' + $_.AccessControlType + '|' + $_.IsInherited }); ` +
      `[pscustomobject]@{ owner = $o; protectedAcl = $a.AreAccessRulesProtected; aces = $aces } | ConvertTo-Json -Compress`,
  );
  if (r.code !== 0) throw new Error(r.err);
  const j = JSON.parse(r.out) as { owner: string; protectedAcl: boolean; aces: string[] | string };
  return { owner: j.owner, protectedAcl: j.protectedAcl, aces: (Array.isArray(j.aces) ? j.aces : [j.aces]).sort() };
}

describe.skipIf(!elevated)("Protect-NodeModulesDir (M9)", () => {
  let base: string;
  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "lsbd-nm-"));
  });
  afterAll(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  const EXPECTED = ["S-1-5-18|FullControl|Allow|False", "S-1-5-32-544|FullControl|Allow|False"];

  it("creates a missing directory as Administrators-owned, SYSTEM + Administrators only; idempotent", () => {
    const dir = path.join(base, "node_modules");
    const run = () => ps(`. ${q(HELPER)}; Protect-NodeModulesDir -Path ${q(dir)}`);
    const first = run();
    expect(first.code, first.err).toBe(0);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
    const a = aclOf(dir);
    expect(a.owner).toBe("S-1-5-32-544");
    expect(a.protectedAcl).toBe(true);
    expect(a.aces).toEqual(EXPECTED);
    const second = run();
    expect(second.code, second.err).toBe(0);
    expect(aclOf(dir)).toEqual(a);
  });

  it("locks down an existing empty directory, removing other ACEs", () => {
    const dir = path.join(base, "existing");
    fs.mkdirSync(dir);
    expect(ps(`icacls ${q(dir)} /grant '*S-1-5-32-545:(OI)(CI)M'`).code).toBe(0); // Users: Modify
    const r = ps(`. ${q(HELPER)}; Protect-NodeModulesDir -Path ${q(dir)}`);
    expect(r.code, r.err).toBe(0);
    expect(aclOf(dir).aces).toEqual(EXPECTED);
  });

  it("refuses (throws) when the directory already has content", () => {
    const dir = path.join(base, "planted");
    fs.mkdirSync(path.join(dir, "evil"), { recursive: true });
    const r = ps(`. ${q(HELPER)}; Protect-NodeModulesDir -Path ${q(dir)}`);
    expect(r.code).not.toBe(0);
    expect(r.err + r.out).toMatch(/not empty/);
  });
});
