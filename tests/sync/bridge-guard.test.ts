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
];

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
