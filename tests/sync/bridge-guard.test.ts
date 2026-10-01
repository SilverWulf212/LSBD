import { describe, it, expect, beforeAll } from "vitest";
import { spawn } from "node:child_process";
import * as path from "node:path";

// Offline test of the bridge's SELECT-only guard: runs `bridge.ps1 -Mode guard`, which
// compiles the same C# helper the bridge uses and answers {"refused":bool} per line.
// No secrets, no VM.

const BRIDGE = path.resolve(__dirname, "../../scripts/sync/bridge.ps1");

const CASES: Array<[string, boolean]> = [
  // Brief case and literal/identifier handling.
  ["DELETE FROM tblFees", true],
  ["SELECT 'delete from x' AS [update]", false],
  ["SELECT [a]]delete] FROM t", false],
  ['SELECT "update" FROM t', false],
  ["SELECT update_count, LastUpdated, UpdatedBy, CreatedOn FROM t", false],
  ["SELECT N'it''s; DROP TABLE x' AS s", false],
  ["SELECT 1 AS x -- it's\nDELETE FROM dbo.__x --'", true],
  ["SELECT 1 AS x /* /* */ ' */ DELETE FROM dbo.__x --'", true],
  ["select 1 -- drop in a comment is refused (conservative)", true],
  ["EXECUTE ('SELECT 1')", true],
  ["SELECT * INTO t2 FROM t", true],
  ["SELECT 1; COMMIT", true],
  // Keywords glued to numeric literals (T-SQL lexes 1DELETE as 1 DELETE).
  ["SELECT 1DELETE FROM dbo.__x", true],
  ["SELECT 1COMMIT", true],
  ["SELECT 1DELETE FROM dbo.tblFees SELECT 1COMMIT", true],
  ["SELECT 1 AS [delete]", false],
  ["SELECT 0xAINSERT dbo.__x VALUES (1)", true],
  ["SELECT 1EXEC ('x')", true],
  ["SELECT 1.5DELETE FROM dbo.__x", true],
  ["SELECT $DELETE FROM dbo.__x", true],
  ["SELECT 1 AS x1delete", false],
  ["SELECT 1 AS DELETE1", false],
  ["SELECT 0xDEADBEEF AS b", false],
  // Float literals spelled <digits>.e<digits> must not hide a glued keyword.
  ["SELECT 1.e5DELETE FROM dbo.x", true],
  ["SELECT 1.E5COMMIT", true],
  ["SELECT 0.E5INTO", true],
  ["SELECT 1.e5WAITFOR", true],
  ["SELECT $1.e5delete", true],
  ["SELECT 1.eDELETE FROM x", true],
  ["SELECT t1.[Key] FROM dbo.x t1", false],
  ["SELECT tbl1.x, 1.5 AS f, 2.e3 AS g FROM dbo.tbl1", false],
  // Pass-through, sequences, waits.
  ["SELECT * FROM OPENQUERY(srv, 'SELECT 1')", true],
  ["SELECT * FROM OPENROWSET('SQLNCLI', 'x', 'SELECT 1')", true],
  ["SELECT * FROM OPENDATASOURCE('SQLNCLI', 'x').db.dbo.t", true],
  ["SELECT NEXT VALUE FOR dbo.seq", true],
  ["SELECT NEXT /* c */ VALUE\n FOR dbo.seq", true],
  ["SELECT 1; WAITFOR DELAY '00:00:05'", true],
  // Lock escalation and isolation overrides.
  ["SELECT * FROM t WITH (UPDLOCK)", true],
  ["SELECT * FROM t WITH (XLOCK)", true],
  ["SELECT * FROM t WITH (HOLDLOCK)", true],
  ["SELECT * FROM t WITH (TABLOCKX)", true],
  ["SELECT * FROM t WITH (TABLOCK)", true],
  ["SELECT * FROM t WITH (PAGLOCK)", true],
  ["SELECT * FROM t WITH (SERIALIZABLE)", true],
  ["SELECT * FROM t WITH (REPEATABLEREAD)", true],
  ["SELECT * FROM t WITH (READCOMMITTEDLOCK)", true],
  ["SET TRANSACTION ISOLATION LEVEL SERIALIZABLE; SELECT 1", true],
  ["SET /*x*/ TRANSACTION ISOLATION LEVEL READ COMMITTED; SELECT 1", true],
  // Things the sync itself sends must pass.
  ["SELECT * FROM t WITH (NOLOCK)", false],
  ["SELECT 1 AS x; SELECT 1/0", false],
  [
    "SELECT [Key] AS k, CONVERT(char(64), HASHBYTES('SHA2_256', CAST(N'' AS nvarchar(max)) + ISNULL(CONVERT(nvarchar(30), [d], 126), NCHAR(9216))), 2) AS h FROM dbo.[tblDenHyg] WITH (NOLOCK)",
    false,
  ],
  ["SELECT N'x' AS t, COUNT_BIG(*) AS n, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS fp FROM dbo.[tblFees] WITH (NOLOCK)", false],
  ["SELECT t.name, SCHEMA_NAME(t.schema_id) AS s, 1 AS [rowCount] FROM sys.tables t", false],
  // M1 (R42): statements that end or escape the wrapper transaction, or switch database.
  ["SELECT 1; ROLLBACK", true],
  ["SELECT 1\nROLLBACK TRANSACTION", true],
  ["SAVE TRANSACTION s1; SELECT 1", true],
  ["USE master; SELECT 1", true],
  ["SELECT 1 /* x */ ROLLBACK", true],
  ["SELECT 1 AS [rollback], 'use' AS u, \"save\" AS s", false],
  ["SELECT USER_NAME() AS u, c.user_type_id, saved_at, used, rollbacks FROM sys.columns c", false],
  // R38 delete re-check (PK point lookup) must pass.
  ["SELECT [ID] AS k FROM dbo.[tblDenHyg] WHERE [ID] IN (2, 3)", false],
  ["SELECT [Code] AS k FROM dbo.[S] WHERE [Code] IN (N'O''B')", false],
];

function runBridgeGuardMode(requests: object[]): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", BRIDGE, "-Mode", "guard"],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    let out = "";
    let err = "";
    p.stdout.setEncoding("utf8").on("data", (c: string) => (out += c));
    p.stderr.setEncoding("utf8").on("data", (c: string) => (err += c));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`guard exited ${code}: ${err}`));
      resolve(out.split(/\r?\n/).filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as Record<string, unknown>));
    });
    for (const r of requests) p.stdin.write(JSON.stringify(r) + "\n");
    p.stdin.end();
  });
}

function runGuard(sqls: string[]): Promise<boolean[]> {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", BRIDGE, "-Mode", "guard"],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    let out = "";
    let err = "";
    p.stdout.setEncoding("utf8").on("data", (c: string) => (out += c));
    p.stderr.setEncoding("utf8").on("data", (c: string) => (err += c));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`guard exited ${code}: ${err}`));
      const lines = out.split(/\r?\n/).filter((l) => l.trim() !== "");
      resolve(lines.map((l) => (JSON.parse(l) as { refused: boolean }).refused));
    });
    for (const sql of sqls) p.stdin.write(JSON.stringify({ sql }) + "\n");
    p.stdin.end();
  });
}

describe.skipIf(process.platform !== "win32")("bridge SELECT-only guard (offline)", () => {
  let results: boolean[] = [];
  beforeAll(async () => {
    results = await runGuard(CASES.map(([sql]) => sql));
  }, 60_000);

  it("answers every case", () => {
    expect(results.length).toBe(CASES.length);
  });

  it.each(CASES.map(([sql, refused], i) => [i, sql, refused] as const))(
    "#%i %s -> refused=%s",
    (i, _sql, refused) => {
      expect(results[i]).toBe(refused);
    },
  );
});

// M1 (R42): after EXECUTE AS, every VM connection checks the impersonated user's role
// memberships and database permissions and fails closed unless it is the expected read-only
// user: db_denydatawriter = 1, no write-capable role, no database-level write permission.
const GOOD = {
  u: "lsbdverify",
  denywriter: 1,
  owner: 0,
  writer: 0,
  ddl: 0,
  sec: 0,
  acc: 0,
  bkp: 0,
  db_alter: 0,
  db_control: 0,
  db_create_table: 0,
  db_insert: 0,
  db_update: 0,
  db_delete: 0,
  db_execute: 0,
};
const ROLE_CASES: Array<[string, Record<string, unknown>, RegExp | null]> = [
  ["the live lsbdverify profile passes", GOOD, null],
  ["another user", { ...GOOD, u: "dbo" }, /user/],
  ["not in db_denydatawriter", { ...GOOD, denywriter: 0 }, /denywriter/],
  ["db_denydatawriter unknown (NULL)", { ...GOOD, denywriter: null }, /denywriter/],
  ["db_owner member", { ...GOOD, owner: 1 }, /owner/],
  ["db_datawriter member", { ...GOOD, writer: 1 }, /writer/],
  ["db_ddladmin member", { ...GOOD, ddl: 1 }, /ddl/],
  ["database INSERT permission", { ...GOOD, db_insert: 1 }, /db_insert/],
  ["a check missing from the row fails closed", (({ db_alter: _x, ...rest }) => rest)(GOOD), /db_alter/],
];

describe.skipIf(process.platform !== "win32")("bridge read-only role check (offline)", () => {
  let results: Record<string, unknown>[] = [];
  beforeAll(async () => {
    results = await runBridgeGuardMode(ROLE_CASES.map(([, roles]) => ({ roles, expect: "lsbdverify" })));
  }, 60_000);

  it.each(ROLE_CASES.map(([name, , problem], i) => [i, name, problem] as const))("#%i %s", (i, _name, problem) => {
    const got = results[i]?.problem;
    if (problem === null) expect(got).toBeNull();
    else expect(String(got)).toMatch(problem);
  });
});
