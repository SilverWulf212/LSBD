# LSBD P0 Housekeeping + P1 Sync Engine & Transforms — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wipe the stale May load. Then build a scheduled one-way MSSQL → Supabase sync (`lsbd_raw` mirror + hash diff) and a set-based transform into `lsbd.*`, so the test site runs on data that is at most 15 minutes old and cutover is just the final run.

**Architecture:** A Node/tsx runner on LSBDserver drives a PowerShell Direct bridge into the LSBDSQL VM, which only ever issues read-only SELECTs. The runner uses a three-tier diff (table fingerprint → key+hash → changed rows), applies the column policy (SSN → HMAC, passwords dropped), and upserts into `lsbd_raw.*` in Supabase. It then calls `lsbd.run_transforms()`, plpgsql functions that upsert and delete into the normalized `lsbd.*` schema keyed on legacy keys.

**Tech Stack:** Node 20 + tsx, `pg` 8, vitest (new), Windows PowerShell 5.1 + System.Data.SqlClient (inside the VM), Supabase Postgres 17 via the session pooler, Windows Task Scheduler.

**Spec:** `docs/superpowers/specs/2026-09-30-lsbd-migration-cutover-design.md`

## Global Constraints

- MSSQL is read-only for us: the bridge may only run `SELECT`. No DDL, no DML, no config changes, no Change Tracking.
- Never write to `D:\Data\common\…`. Stage files under `D:\extracted\` or `C:\ProgramData\lsbd-sync\`.
- Row data never enters git. Commit schema DDL, code, and count-only reports; never JSONL, CSV rows, or `.bak` files.
- Supabase connections use `SUPABASE_DB_URL_SESSION` (pooler `aws-1-us-west-1.pooler.supabase.com:5432`). The direct host is IPv6-only and unreachable from this server.
- PowerShell scripts must run on Windows PowerShell 5.1: no `&&`, `??`, or ternary.
- Guest→host file copy uses `New-PSSession -VMName` + `Copy-Item -FromSession`, never `Copy-VMFile`.
- Secrets come from `C:\ProgramData\lsbd-sync\secrets.env` (fallback `C:\Users\Administrator\.lsbd-secrets.env`), parsed as `KEY=VALUE` lines. Never print them.
- SSN HMAC must stay byte-identical to `scripts/etl-b2-pii.ts`: normalise to 9 digits, then base64 HMAC-SHA256 with key `PII_SSN_HMAC_KEY`.
- Excluded source tables: `VSAuth`, `VsCapture`, `dtproperties`. Dropped columns: `tblDenHyg.password`, `Users.Password`. HMAC'd columns: `SSN` on `tblDenHyg`, `Individual`, `tblRndDentists`, `tblRndHygienists`.
- License identity is `tblDenHyg.Key` (one source row = one license). `LICENSEID` is only unique per `Type`, and 17 `(Type, LICENSEID)` groups are duplicates. Never dedupe on `license_id` alone.
- Every commit ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **NULL vs empty vs whitespace strings.** The source hash must distinguish NULL from `''` from `' '`. A column changed from NULL to `''` must be detected as an update (pinned in Task 4).
2. **Key normalisation across systems.** uuid PKs come back uppercase or lowercase depending on the path, and nvarchar keys can carry trailing spaces. `keyOf()` lowercases uuids and preserves nvarchar exactly, and a row must never be seen as delete + insert because of key formatting (pinned in Task 5).
3. **Bridge returns nothing.** A VM or credential hiccup that yields 0 keys must not soft-delete a whole table. The mass-delete guard applies when a table with >100 live rows would lose >50% (pinned in Task 5, enforced in Task 8).
4. **Overlapping or crashed runs.** A second run while one is active exits 0 without touching data. A crash mid-table leaves that raw table exactly as before, because each table is written in its own transaction (pinned in Task 8).
5. **Numeric and date fidelity.** `money` and `decimal` travel as strings, never JS floats. `datetime` values like `2026-09-30T09:58:18.4770000` land in `timestamp` unchanged at millisecond precision (pinned in Task 6).

---

## File Structure

```
scripts/lib/pii.ts                 normalizeSsn, hmacSsn (moved out of etl-b2-pii.ts)
scripts/lib/secrets.ts             loadSecrets(): Record<string,string>
scripts/ops/wipe-stale.ts          P0 wipe of lsbd.* data (+ vs_* tables) — one-shot
scripts/sync/types.ts              shared types
scripts/sync/type-map.ts           MSSQL → Postgres type mapping
scripts/sync/sql-gen.ts            T-SQL generators (row hash, fingerprint, keys, rows)
scripts/sync/raw-ddl.ts            lsbd_raw DDL generator (+ bookkeeping tables)
scripts/sync/policy.ts             exclusions + column policy + applyPolicy()
scripts/sync/diff.ts               keyOf(), diffKeys(), massDeleteGuard()
scripts/sync/bridge.ps1            PowerShell Direct bridge (modes: schema|fingerprint|keys|rows)
scripts/sync/mssql.ts              TS wrapper that spawns bridge.ps1 and parses JSONL
scripts/sync/raw-writer.ts         upsertRaw, softDelete, replaceTable, readRawKeys
scripts/sync/run.ts                CLI orchestrator (quick|full), lock, bookkeeping
scripts/sync/bootstrap-raw.ts      generate + apply supabase/lsbd_raw.sql
scripts/sync/reconcile.ts          acceptance report (counts + key/hash set equality)
scripts/sync/install-task.ps1      registers Task Scheduler jobs, moves secrets
supabase/lsbd_raw.sql              generated DDL (committed; schema only)
supabase/transforms/*.sql          lsbd.transform_* functions + lsbd.run_transforms()
drizzle/0001_legacy_keys.sql       legacy-key columns/uniques on lsbd.*
src/lib/db/lsbd/*.ts               schema TS updated to match 0001
src/app/admin/sync/page.tsx        staff-only sync status page
tests/sync/*.test.ts               unit tests; tests/it/*.test.ts integration (LSBD_IT=1)
vitest.config.ts
```

---

### Task 1: P0 — Wipe stale data and local extracts

**Files:**
- Create: `scripts/ops/wipe-stale.ts`
- Create: `scripts/lib/secrets.ts`

**Interfaces:**
- Produces: `loadSecrets(): Record<string, string>`. It reads `C:\ProgramData\lsbd-sync\secrets.env` if present, otherwise `C:\Users\Administrator\.lsbd-secrets.env`, and does not mutate `process.env`.

- [ ] **Step 1: Implement `wipe-stale.ts`.**
  - It connects with `SUPABASE_DB_URL_SESSION`.
  - It lists every base table in schema `lsbd` from `information_schema.tables`.
  - It prints `table: count` for each, then runs one `TRUNCATE … RESTART IDENTITY CASCADE` over all of them inside a transaction.
  - It requires the flag `--yes`; without it, it prints the counts and exits 1.
  - It never touches schema `public` (CMS content) or any DDL.
- [ ] **Step 2: Dry run.** Run `npx tsx scripts/ops/wipe-stale.ts`. Expected: counts listed (e.g. `person: 19070`, `vs_auth: 2956`) and exit 1.
- [ ] **Step 3: Wipe.** Run `npx tsx scripts/ops/wipe-stale.ts --yes`. Expected: "wiped N tables", and a re-count prints 0 for every `lsbd` table.
- [ ] **Step 4: Delete local row extracts.** Run `Remove-Item D:\extracted\data\*.jsonl` (PowerShell). Keep `D:\extracted\schema\` and `D:\extracted\LSBDDB_20260512_085129.bak`; the `.bak` is disposed of at decommission per spec §8. Expected: `(Get-ChildItem D:\extracted\data).Count` is 0.
- [ ] **Step 5: Commit.**

```bash
git add scripts/ops/wipe-stale.ts scripts/lib/secrets.ts
git commit -m "ops: one-shot wipe of stale lsbd.* data"
```

### Task 2: Test harness + PII helpers

**Files:**
- Create: `vitest.config.ts`, `scripts/lib/pii.ts`, `tests/sync/pii.test.ts`
- Modify: `package.json` (devDependency `vitest`; scripts `test`, `test:it`), `scripts/etl-b2-pii.ts` (import from `scripts/lib/pii.ts`)

**Interfaces:**
- Produces: `normalizeSsn(v: unknown): string | null` (9 digits, or null) and `hmacSsn(key: Buffer, ssn9: string): string` (base64).

- [ ] **Step 1: Write the failing test** in `tests/sync/pii.test.ts`:
  - `normalizeSsn("123-45-6789") === "123456789"`.
  - `normalizeSsn("12345") === null`.
  - `normalizeSsn(null) === null`.
  - `hmacSsn(Buffer.from("k"), "123456789")` equals `crypto.createHmac("sha256", Buffer.from("k")).update("123456789").digest("base64")`.
  - The same input called twice gives the same output.
- [ ] **Step 2: Run the test and confirm it fails.** Run `npm test -- tests/sync/pii.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Move `normalizeSsn` and the HMAC function verbatim from `scripts/etl-b2-pii.ts` into `scripts/lib/pii.ts`, then re-import them in `etl-b2-pii.ts`. Add the package scripts `"test": "vitest run tests/sync"` and `"test:it": "vitest run tests/it"`. Every file under `tests/it/` wraps its suite in `describe.skipIf(process.env.LSBD_IT !== "1")`; run them with `$env:LSBD_IT='1'; npm run test:it`.
- [ ] **Step 4: Run the test and confirm it passes.** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `test: vitest harness; extract PII helpers`.

### Task 3: Type map + raw DDL generator

**Files:**
- Create: `scripts/sync/types.ts`, `scripts/sync/type-map.ts`, `scripts/sync/raw-ddl.ts`, `tests/sync/raw-ddl.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `SourceColumn { name: string; type: string; maxLength: number; precision: number; scale: number; nullable: boolean; ordinal: number }`
  - `SourceTable { name: string; pk: string | null; columns: SourceColumn[]; rowCount: number }`. `pk` is the single PK column name; null means there is no PK. Composite PKs occur only in the excluded `dtproperties`.
  - `type ColumnAction = "hmac" | "drop"` and `type TablePolicy = Record<string, ColumnAction>`
  - `type KeyHash = { k: string; h: string }`
- Produces: `pgTypeFor(c: SourceColumn): string` and `rawTableDdl(t: SourceTable, policy: TablePolicy): string`, plus `bookkeepingDdl(): string`.

- [ ] **Step 1: Write failing tests.**
  - **`pgTypeFor`** maps each spec §4.1 row:

    | Source type | Expected |
    |---|---|
    | nvarchar | `text` |
    | ntext | `text` |
    | int | `integer` |
    | tinyint | `smallint` |
    | bit | `boolean` |
    | smalldatetime | `timestamp` |
    | money | `numeric` |
    | float | `double precision` |
    | uniqueidentifier | `uuid` |
    | image | `bytea` |

    An unknown type throws `Unsupported MSSQL type: xml`.
  - **`rawTableDdl`** for `{name:"tblDenHyg", pk:"Key", columns:[Key int, LastName nvarchar, SSN nvarchar, password nvarchar]}` with policy `{SSN:"hmac", password:"drop"}`:
    - It contains `CREATE TABLE IF NOT EXISTS lsbd_raw."tblDenHyg"`, `"Key" integer NOT NULL PRIMARY KEY`, `"SSN" text`, and `_row_hash text NOT NULL`, `_synced_at timestamptz NOT NULL DEFAULT now()`, `_deleted_at timestamptz`.
    - It does **not** contain `"password"`.
    - It contains `REVOKE ALL ON lsbd_raw."tblDenHyg" FROM anon, authenticated` and `ENABLE ROW LEVEL SECURITY`.
  - **No-PK table:** the DDL contains `_rowid bigserial PRIMARY KEY`.
  - **`bookkeepingDdl()`** creates `lsbd_raw._sync_runs` and `lsbd_raw._sync_tables` with exactly the columns in spec §4.3.
- [ ] **Step 2: Run the tests and confirm they fail.** Run `npm test -- tests/sync/raw-ddl.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Quote every identifier with double quotes; source columns keep their exact case. Emit `CREATE SCHEMA IF NOT EXISTS lsbd_raw;` once, from `bookkeepingDdl()`.
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(sync): type map + lsbd_raw DDL generator`.

### Task 4: Column policy + T-SQL generators

**Files:**
- Create: `scripts/sync/policy.ts`, `scripts/sync/sql-gen.ts`, `tests/sync/policy.test.ts`, `tests/sync/sql-gen.test.ts`

**Interfaces:**
- Produces (`policy.ts`):
  - `EXCLUDED_TABLES: ReadonlySet<string>` = `VSAuth`, `VsCapture`, `dtproperties`.
  - `policyFor(table: string): TablePolicy` (the types come from `types.ts`, Task 3).
  - `applyPolicy(table: string, row: Record<string, unknown>, hmacKey: Buffer): Record<string, unknown>`. `hmac` replaces the value with `hmacSsn(hmacKey, normalizeSsn(v))`, or null when normalisation returns null; `drop` deletes the key.
- Produces (`sql-gen.ts`):
  - `rowHashExpr(cols: SourceColumn[]): string`
  - `fingerprintSql(tables: SourceTable[]): string`: one statement with a `UNION ALL` of `SELECT '<t>' AS t, COUNT_BIG(*) AS n, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS fp FROM dbo.[<t>] WITH (NOLOCK)`.
  - `keysSql(t: SourceTable): string` returns `k, h`. It throws `keysSql requires a PK` when `t.pk` is null; no-PK tables are always replaced wholesale.
  - `rowsSql(t: SourceTable, keys: string[] | "all"): string`: `SELECT *, <rowHashExpr> AS __h …`, adding `WHERE [pk] IN (…)` when keys are given. Keys are emitted as N'…' literals with `'` doubled, or as bare integers for int PKs.

- [ ] **Step 1: Write failing tests.**
  - **`applyPolicy("tblDenHyg", {Key:1, SSN:"123-45-6789", password:"x", LastName:"A"}, key)`:**
    - It returns `LastName` "A", `Key` 1, and `SSN` equal to `hmacSsn(key, "123456789")`.
    - The result has no `password` key.
  - **`applyPolicy("Users", {Password:"p", UserName:"u"}, key)`** has no `Password` key.
  - **`policyFor("Office")`** is `{}`.
  - **`rowHashExpr`** for `[a nvarchar, b datetime, c ntext, d image, e float]`:
    - It contains `CONVERT(nvarchar(30), [b], 126)`, `CAST([c] AS nvarchar(max))`, `CONVERT(nvarchar(max), CAST([d] AS varbinary(max)), 2)`, `CONVERT(nvarchar(30), [e], 3)`, `NCHAR(31)` and `HASHBYTES('SHA2_256'`.
    - It wraps each column in `ISNULL(…, N'␀')` so NULL ≠ `''` (Review Focus 1).
  - **`rowsSql(t, ["O'Brien"])`** contains `N'O''Brien'`.
  - **`rowsSql(intPkTable, ["12"])`** contains `IN (12)`.
  - **`rowsSql(intPkTable, ["12; DROP"])`** throws `Invalid integer key`.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement** per the canonicalisation table in spec §4.1. The hash output is `CONVERT(char(64), HASHBYTES(…), 2)`.
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(sync): column policy + T-SQL generators`.

### Task 5: Key diff + mass-delete guard

**Files:**
- Create: `scripts/sync/diff.ts`, `tests/sync/diff.test.ts`

**Interfaces:**
- Consumes: `SourceColumn` and `KeyHash` (Task 3).
- Produces:
  - `keyOf(v: unknown, pkType: string): string`: a uuid is lowercased; an int becomes its decimal string; anything else is `String(v)`, unmodified (no trim).
  - `diffKeys(source: KeyHash[], target: KeyHash[]): { inserted: string[]; updated: string[]; deleted: string[] }`.
  - `massDeleteGuard(liveCount: number, deleteCount: number): boolean`. It returns true (block) when `liveCount > 100 && deleteCount > liveCount * 0.5`.

- [ ] **Step 1: Write failing tests.**
  - **`diffKeys`** with source `[{k:"1",h:"a"},{k:"2",h:"b"},{k:"4",h:"d"}]` and target `[{k:"1",h:"a"},{k:"2",h:"x"},{k:"3",h:"c"}]` returns `{inserted:["4"], updated:["2"], deleted:["3"]}`.
  - **`keyOf`:**
    - `keyOf("ABCDEF00-0000-0000-0000-000000000001","uniqueidentifier") === "abcdef00-0000-0000-0000-000000000001"`.
    - `keyOf("A1 ","nvarchar") === "A1 "`.
    - `keyOf(12,"int") === "12"`.
  - **uuid round trip:** after `keyOf`, a source key in uppercase and a target key in lowercase produce an empty diff (Review Focus 2).
  - **`massDeleteGuard`:**
    - `massDeleteGuard(19285, 19285) === true`.
    - `massDeleteGuard(19285, 40) === false`.
    - `massDeleteGuard(4, 4) === false`.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement** with `Map`s. Must be O(n).
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(sync): key diff + mass-delete guard`.

### Task 6: PowerShell Direct bridge + TS wrapper

**Files:**
- Create: `scripts/sync/bridge.ps1`, `scripts/sync/mssql.ts`, `tests/it/bridge.test.ts`

**Interfaces:**
- **`bridge.ps1` parameters:** `-Mode schema|query`, `-SqlFile <path>` (used with `query`), `-Database LSBDDB`.
  - It loads the VM credentials via the secrets file.
  - It opens `Invoke-Command -VMName $env:MSSQL_VM_NAME`.
  - Inside the VM it runs the SQL through `System.Data.SqlClient` (Integrated Security, `ApplicationIntent=ReadOnly`, `CommandTimeout=900`) and writes **one compact JSON object per row to stdout**.
  - **Value encoding:**

    | Source value | Encoded as |
    |---|---|
    | `DBNull` | `null` |
    | `DateTime` | `ToString('yyyy-MM-ddTHH:mm:ss.fff')` |
    | `Guid` | `ToString()` (lowercase) |
    | `decimal` | `ToString([Globalization.CultureInfo]::InvariantCulture)`, as a JSON string |
    | `byte[]` | base64 string |
    | `bool` | `true` / `false` |
    | everything else | native |

  - **`schema` mode** emits one object per table: `{name, pk, rowCount, columns:[…SourceColumn]}`. Composite-PK tables report `pk:null`, but they are excluded anyway.
  - The script refuses any `-SqlFile` whose text matches `(?i)\b(insert|update|delete|merge|drop|alter|create|truncate|exec|grant)\b` outside of string literals, with exit code 3 and the message `bridge: non-SELECT refused`.
- **`mssql.ts` produces:**
  - `readSchema(): Promise<SourceTable[]>`
  - `query<T>(sql: string): AsyncIterable<T>`. It writes the SQL to a temp file under `os.tmpdir()`, spawns `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/sync/bridge.ps1 -Mode query -SqlFile <tmp>`, streams stdout line by line through `JSON.parse`, rejects on a non-zero exit with the stderr text, and deletes the temp file.

- [ ] **Step 1: Write the failing integration test** in `tests/it/bridge.test.ts`, gated on `LSBD_IT=1`:
  - `readSchema()` returns ≥ 80 tables; `tblDenHyg` has `pk === "Key"` and a column `SSN`.
  - `query("SELECT TOP 1 CAST('2026-09-30T09:58:18.477' AS datetime) AS d, CAST(12.3400 AS money) AS m, CAST(NULL AS nvarchar(5)) AS n")` yields `{d:"2026-09-30T09:58:18.477", m:"12.3400", n:null}` (Review Focus 5).
  - `query("DELETE FROM tblFees")` rejects with `non-SELECT refused`.
- [ ] **Step 2: Run the test and confirm it fails.** Run `$env:LSBD_IT='1'; npx vitest run tests/it/bridge.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** For large results, don't collect a list inside the VM. Have the VM script build JSON strings incrementally and return a `string[]` per 5,000-row page (loop with `OFFSET/FETCH` or reader chunking), so remoting serialises strings, not hashtables.
- [ ] **Step 4: Run the test and confirm it passes.** Expected: PASS. Also record the time `query("SELECT * FROM tblTransSplits")` takes to stream all rows, and note it in the commit message. It is the throughput baseline for spec risk #3.
- [ ] **Step 5: Commit.** Message: `feat(sync): PowerShell Direct read-only bridge (baseline: tblTransSplits Ns)`.

### Task 7: Bootstrap `lsbd_raw` + raw writer

**Files:**
- Create: `scripts/sync/bootstrap-raw.ts`, `scripts/sync/raw-writer.ts`, `supabase/lsbd_raw.sql` (generated), `tests/it/raw-writer.test.ts`
- Modify: `package.json` (script `"sync:bootstrap": "tsx scripts/sync/bootstrap-raw.ts"`)

**Interfaces:**
- Consumes: `readSchema()` (Task 6), `rawTableDdl` / `bookkeepingDdl` (Task 3), `policyFor` / `EXCLUDED_TABLES` (Task 4).
- Produces (`raw-writer.ts`, all taking a `pg.Client`):
  - `readRawKeys(c, t: SourceTable): Promise<KeyHash[]>` (live rows only)
  - `upsertRaw(c, t, rows: Record<string, unknown>[]): Promise<number>`: batches of 500, `INSERT … ON CONFLICT ("pk") DO UPDATE SET <all cols>, _row_hash, _synced_at = now(), _deleted_at = NULL`; `bytea` columns via `decode($n,'base64')`
  - `softDelete(c, t, keys: string[]): Promise<number>`
  - `replaceTable(c, t, rows): Promise<number>`: `DELETE FROM` then insert, in the caller's transaction
  - `rowToRaw(row): Record<string, unknown>`, which moves `__h` to `_row_hash`

- [ ] **Step 1: Write the failing integration test** (`LSBD_IT=1`). Inside `BEGIN … ROLLBACK`:
  - Create a temporary table shaped like the generated `lsbd_raw."tblFees"`, then `upsertRaw` two rows.
  - Upsert one of them again with a different `__h` → `_row_hash` is updated.
  - `softDelete` the other → `readRawKeys` returns 1 key.
  - Upsert the deleted key again → `_deleted_at` is NULL.
- [ ] **Step 2: Run the test and confirm it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** `bootstrap-raw.ts`:
  1. Reads the schema.
  2. Skips `EXCLUDED_TABLES`.
  3. Writes `supabase/lsbd_raw.sql` (bookkeeping DDL + one `rawTableDdl` per table, sorted by name).
  4. Applies it statement by statement over the session pooler.
  5. Prints `N tables created`.
- [ ] **Step 4: Run the test and confirm it passes, then bootstrap.** Run `npm run test:it` → PASS. Run `npm run sync:bootstrap` → expected `79 tables created` (82 − 3 excluded).
- [ ] **Step 5: Commit** `supabase/lsbd_raw.sql` with the code. Message: `feat(sync): lsbd_raw bootstrap + raw writer`.

### Task 8: Sync runner (quick | full)

**Files:**
- Create: `scripts/sync/run.ts`, `tests/it/run.test.ts`
- Modify: `package.json` (scripts `"sync": "tsx scripts/sync/run.ts"`, `"sync:full": "tsx scripts/sync/run.ts --mode full"`)

**Interfaces:**
- **CLI:** `run.ts --mode quick|full [--tables A,B | --tables none] [--no-transform] [--allow-mass-delete]`. `--tables none` skips the sync and only runs transforms.
- **Exit codes:** 0 = ok or "already running"; 1 = failure; 2 = mass-delete guard tripped.
- Produces: `runSync(opts: { mode: "quick"|"full"; tables?: string[] | "none"; transform: boolean; allowMassDelete: boolean }, deps?: { readSchema: typeof readSchema; query: typeof query }): Promise<RunSummary>`.
  - `deps` defaults to the real bridge (Task 6) and exists so tests can inject a fake source.
  - `RunSummary = { runId: number; status: "ok"|"failed"|"blocked"|"skipped"; tablesChanged: string[]; inserted: number; updated: number; deleted: number; orphansSkipped: number }`.

- [ ] **Step 1a: Write the failing unit test** (`tests/sync/run-guard.test.ts`; uses a real `pg` connection inside `BEGIN … ROLLBACK`, so it is gated like the IT tests):
  - Set up raw state: seed 200 live rows into a scratch copy of `lsbd_raw."tblTypes"`.
  - Call `runSync({mode:"full", tables:["tblTypes"], transform:false, allowMassDelete:false}, fakeDeps)`, where the fake returns a schema containing `tblTypes` and 0 keys.
  - Expected: `status === "blocked"`, the live raw row count is still 200, and the CLI maps this to exit code 2 (Review Focus 3).
- [ ] **Step 1b: Write the failing integration tests** (`LSBD_IT=1`):
  - `runSync({mode:"full", tables:["tblFees","tblTypes"], transform:false})` returns a summary. Afterwards `lsbd_raw."tblTypes"` live count equals the source count from `query("SELECT COUNT(*) n FROM tblTypes")`.
  - A second immediate `runSync({mode:"quick", tables:["tblTypes"]})` reports `tablesChanged: []`.
  - While a session holds `pg_advisory_lock(hashtext('lsbd_sync'))`, `runSync` resolves with `runId: -1` and does not write `_sync_runs` (Review Focus 4).
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement the flow:**
  1. Take the advisory lock, or return `-1`.
  2. Insert a `_sync_runs` row with status `running`.
  3. `readSchema()`. Warn about any source table not in `lsbd_raw` (schema drift) without failing, and include it in the run error field.
  4. **Quick mode:** run `fingerprintSql` and compare `(n, fp)` against `_sync_tables`. Tables that differ, plus all no-PK tables, become the work list. **Full mode:** every table goes on the work list.
  5. **For each table, in its own transaction:**
     - For PK tables: `keysSql` → `diffKeys` against `readRawKeys`, with the mass-delete guard (a block without `--allow-mass-delete` marks the table `blocked` and sets exit 2 without writing).
     - Fetch rows for inserted + updated keys in chunks of 1,000, or use `rowsSql(t,"all")` when changed keys exceed 30% of rows. Apply `applyPolicy` and `upsertRaw`, then `softDelete`.
     - For no-PK tables: `replaceTable`.
     - Update `_sync_tables`.
  6. Unless `--no-transform`, `CALL lsbd.run_transforms()` (Task 11) and store its orphan count.
  7. Finish the `_sync_runs` row (`ok` / `failed` / `blocked`).
  8. On success, if `SYNC_HEALTHCHECK_URL` is set, `fetch` it.
  9. On failure, write to the Windows event log via `powershell -Command "Write-EventLog -LogName Application -Source LSBD-Sync -EventId 1001 -EntryType Error -Message …"`. The source is registered by Task 12.
- [ ] **Step 4: Run the tests and confirm they pass,** then run `npm run sync:full -- --no-transform`. Expected: exit 0; `_sync_runs` shows `ok`; every table's live raw count equals its source count. Record the duration in the commit message.
- [ ] **Step 5: Commit.** Message: `feat(sync): quick/full runner with lock, guard, bookkeeping (full run: Ns)`.

### Task 9: Reconcile report (acceptance evidence)

**Files:**
- Create: `scripts/sync/reconcile.ts`, `tests/sync/reconcile.test.ts`
- Modify: `package.json` (script `"sync:reconcile"`), `.gitignore` (add `reports/`)

**Interfaces:**
- Produces: `compareTable(sourceCount: number, source: KeyHash[], raw: KeyHash[]): { countMatch: boolean; setMatch: boolean; missing: number; extra: number; hashMismatch: number }`, plus the CLI, which writes `reports/reconcile-<yyyyMMdd-HHmm>.md`. The report is a table of name, source count, raw live count and PASS/FAIL, with counts only and no values. The CLI exits 1 on any FAIL.

- [ ] **Step 1: Write failing unit tests for `compareTable`:**
  - Identical sets → all true, zeros.
  - One key missing and one hash differing → `missing:1, hashMismatch:1, setMatch:false`.
  - A source count that differs from the number of source keys → `countMatch:false`.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement** by reusing `keysSql`, `readRawKeys` and `diffKeys`.
- [ ] **Step 4: Run the tests and confirm they pass,** then run `npm run sync:reconcile`. Expected: every synced table PASS and exit 0.
- [ ] **Step 5: Commit.** Message: `feat(sync): reconcile report for acceptance criteria 1–2`.

### Task 10: Legacy keys on `lsbd.*` (fixes the license collapse)

**Files:**
- Create: `drizzle/0001_legacy_keys.sql`
- Modify: `src/lib/db/lsbd/core.ts`, `operations.ts`, `reference.ts`

**Interfaces:**
- Produces, for every `lsbd` table, a documented upsert key recorded in a header comment in `0001_legacy_keys.sql` (a table → key list):
  - `lsbd.person.legacy_key integer UNIQUE NOT NULL` (source `tblDenHyg.Key`).
  - `lsbd.license.legacy_key` becomes `UNIQUE NOT NULL`.
  - `lsbd.license.license_id` **loses** any unique constraint or index; add a non-unique index `license_type_license_id_idx` on `(type, license_id)`.
  - `lsbd.licensee_pii` keeps its unique `person_id`.
  - Tables whose `serial id` already holds the source integer PK (per the "Preserve source integer IDs" comments in `etl-b2-entities.ts`) use `id` as the key.
  - Tables with a generated id and no source key get `legacy_id text UNIQUE NOT NULL` (the source PK as text).

- [ ] **Step 1: Build the key list.** For each of the 86 tables, read its B-1…B-4 ETL mapper and record the source table + source PK → target key column. Write the list into the header of `0001_legacy_keys.sql`.
- [ ] **Step 2: Update the Drizzle TS to match,** run `npx drizzle-kit generate --name legacy_keys`, and diff the output against the hand-written header. They must agree, and the hand list wins on naming.
- [ ] **Step 3: Apply** via `npx tsx scripts/apply-migration.ts drizzle/0001_legacy_keys.sql`. The tables are empty after Task 1, so `NOT NULL` is safe. Expected: all statements OK.
- [ ] **Step 4: Verify.** Query `information_schema.table_constraints` to confirm a UNIQUE or PK constraint exists on the documented key of every `lsbd` table (script prints `86/86`), and that no unique constraint on `license(license_id)` alone remains.
- [ ] **Step 5: Commit.** Message: `fix(schema): legacy upsert keys; license identity is tblDenHyg.Key`.

### Task 11: Set-based transforms `lsbd_raw` → `lsbd`

**Files:**
- Create: `supabase/transforms/00_helpers.sql`, `10_lookups.sql`, `20_geography.sql`, `30_entities.sql`, `40_denhyg_pii.sql`, `50_relationships.sql`, `60_operational.sql`, `70_financial.sql`, `80_compliance.sql`, `99_run.sql`
- Create: `scripts/sync/apply-transforms.ts`, `tests/it/transforms.test.ts`
- Modify: `package.json` (scripts `"sync:transforms:apply"`, `"uat:reset": "tsx scripts/sync/run.ts --mode quick --tables none"`; with `--tables none` the runner goes straight to transforms)

**Interfaces:**
- Consumes: `lsbd_raw.*` (Task 7) and the legacy keys (Task 10).
- Produces:
  - `lsbd.transform_<domain>() RETURNS integer` (orphans skipped) for each of `lookups`, `geography`, `entities`, `denhyg_pii`, `relationships`, `operational`, `financial`, `compliance`.
  - `PROCEDURE lsbd.run_transforms(INOUT orphans integer DEFAULT 0)`. It calls the functions in that order inside the caller's transaction, then runs the delete passes in reverse order.
  - **Mapping source of truth:**

    | Transform file | Ported from |
    |---|---|
    | `10_lookups` | `scripts/etl-b1b-lookups.ts`, `etl-b1c-settings.ts` |
    | `20_geography` | `etl-b1a-geography.ts` |
    | `30_entities` | `etl-b2-entities.ts` |
    | `40_denhyg_pii` | `etl-tbldenhyg.ts` + `etl-b2-pii.ts`, **except** one `person` + one `license` per `tblDenHyg` row keyed by `Key` (no license-id dedupe); `licensee_pii.ssn_hash` comes straight from `lsbd_raw."tblDenHyg"."SSN"` (already HMAC'd) |
    | `50_relationships` / `60_operational` / `70_financial` | `etl-b3.ts` groups |
    | `80_compliance` | `etl-b4.ts` |

  - **Every upsert:** `INSERT … SELECT … FROM lsbd_raw.<src> WHERE _deleted_at IS NULL [AND parent exists] ON CONFLICT (<key>) DO UPDATE SET … WHERE (<target cols>) IS DISTINCT FROM (<excluded cols>)`.
  - **Every delete:** `DELETE FROM lsbd.<t> WHERE <key> NOT IN (SELECT <key expr> FROM lsbd_raw.<src> WHERE _deleted_at IS NULL)`.
  - **Orphans** (children whose parent key doesn't exist) are counted with `GET DIAGNOSTICS` against a pre-count and are not inserted.
  - **Serial sequences** are bumped with `setval` to `MAX(id)` at the end of `run_transforms`.

- [ ] **Step 1: Write the failing integration tests** (`LSBD_IT=1`). Each runs inside `BEGIN … ROLLBACK` on synthetic keys ≥ 900000000:
  - **(a) Insert/update:** insert two `lsbd_raw."tblDenHyg"` rows with the same `LICENSEID` "900001" but `Type` 'D' and 'H', then `CALL lsbd.run_transforms()`. `lsbd.license` has 2 rows with `license_id='900001'` (types D and H), and `lsbd.person` has 2 rows. Update `LastName` on one raw row and re-run → the person's `last_name` changes and the row count stays 2.
  - **(b) Delete:** set `_deleted_at=now()` on one raw row and re-run → its license and person are gone. The row's `licensee_pii` is removed by cascade.
  - **(c) Orphans:** a raw `OfficeAffiliation` row pointing at a nonexistent office → the orphan count returned is ≥ 1, and no row is inserted.
  - **(d) Idempotence:** running `run_transforms` twice leaves `pg_stat_user_tables.n_tup_upd` for `lsbd.license` unchanged on the second run (the `IS DISTINCT FROM` guard works).
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL (the procedure doesn't exist yet).
- [ ] **Step 3: Implement the files in numeric order.** `apply-transforms.ts` applies `supabase/transforms/*.sql` in filename order, each file in one transaction; the files use `CREATE OR REPLACE`. Run `npm run sync:transforms:apply`.
- [ ] **Step 4: Run the tests and confirm they pass,** then do the real load: `npm run sync -- --mode quick --tables none`. Expected:
  - `lsbd.license` count equals the `lsbd_raw."tblDenHyg"` live count (~19,285, not 8,985).
  - The run's orphan count is logged.
  - Counts for other tables match the ETL-era totals within the source's growth since May.
- [ ] **Step 5: Commit.** Message: `feat(transform): set-based lsbd_raw→lsbd transforms, idempotent`.

### Task 12: Schedule it + move secrets

**Files:**
- Create: `scripts/sync/install-task.ps1`

**Interfaces:**
- `install-task.ps1` must be run elevated. It is idempotent: it unregisters and re-registers the tasks.
  1. Create `C:\ProgramData\lsbd-sync\` and copy the secrets file there. ACL it with `icacls` `/inheritance:r` and grant only `SYSTEM:F` and `Administrators:F`.
  2. Register the event source with `New-EventLog -LogName Application -Source LSBD-Sync`, ignoring "already exists".
  3. Register the task **`LSBD Sync Quick`**: runs as SYSTEM every 15 minutes from 07:00 to 19:00, Monday–Friday. Action: `C:\Program Files\nodejs\node.exe` with the tsx CLI resolved as `node_modules\tsx\dist\cli.mjs scripts\sync\run.ts --mode quick`. Working dir `C:\Users\Administrator\LSBD-work\LSBD`. `MultipleInstances IgnoreNew`, execution time limit 20 minutes.
  4. Register the task **`LSBD Sync Full`**: runs as SYSTEM daily at 02:00 with `--mode full`, then `sync:reconcile`. Time limit 60 minutes.

- [ ] **Step 1: Implement and run** `powershell -ExecutionPolicy Bypass -File scripts\sync\install-task.ps1`. Expected: `Get-ScheduledTask 'LSBD Sync*'` lists 2 tasks in state Ready.
- [ ] **Step 2: Trigger** with `Start-ScheduledTask 'LSBD Sync Quick'` and wait for completion. Expected: `LastTaskResult` 0, and a new `_sync_runs` row with status `ok` and `tables_changed` listing only recently edited tables.
- [ ] **Step 3: Verify secrets hygiene.** `icacls C:\ProgramData\lsbd-sync\secrets.env` shows only SYSTEM and Administrators.
- [ ] **Step 4: Commit.** Message: `ops(sync): Task Scheduler install (quick 15m business hours, full nightly)`.

### Task 13: `/admin/sync` status page + public verify on the corrected model

**Files:**
- Create: `src/app/admin/sync/page.tsx`
- Modify: `src/lib/public-verify.ts` and `src/app/(public)/public/verify/page.tsx`, so lookups use `(type, license_id)`. Also the admin nav constant next to the existing `/admin/fees` entry.

**Interfaces:**
- The page is a server component, restricted to the admin role using the same guard as `src/app/admin/users`. It shows:
  - The last 20 `lsbd_raw._sync_runs` rows (started, mode, status, changed tables, ins/upd/del, orphans, error).
  - `_sync_tables` (name, source count, raw live count, last changed).
  - A red banner if the latest `ok` run is older than 2 hours between 08:00 and 18:00 on a weekday.

- [ ] **Step 1: Implement the page and fix `/verify`.**
  - A license-number search returns every type holding that number, and each result displays its type (Dentist / Hygienist / EDDA).
  - The anon-facing query still returns only the legacy public fields with ACT/PRB filtering (RLS from Package C unchanged).
- [ ] **Step 2: Verify locally.** Run `npm run build` → build succeeds. Run `npm run dev`, then:
  - `/admin/sync` as the admin user shows runs.
  - `/verify` searching a number held by both a D and an H licensee (pick one with `SELECT license_id FROM lsbd.license GROUP BY 1 HAVING COUNT(DISTINCT type)>1 LIMIT 1`) shows both.
- [ ] **Step 3: Commit.** Message: `feat(admin): sync status page; verify disambiguates license type`.

### Task 14: P0/P1 exit check

- [ ] **Step 1: Freshness.** After a staff edit in Access (ask Erin to change one test-safe field, or watch `tblDenHyg` last update), the next quick run's `_sync_runs.tables_changed` includes that table and `/verify` reflects the change within 15 minutes.
- [ ] **Step 2: Reconcile.** The nightly full run and `reports/reconcile-*.md` show all tables PASS for two consecutive nights.
- [ ] **Step 3: Docs.**
  - Update `CLAUDE.md` "Migration path" to point at this plan and the spec. Correct the firewall claim and record the license-identity bug fix.
  - Publish the reconcile summary (counts only) to the Outline LSBD page.
- [ ] **Step 4: Commit.** Message: `docs: P1 exit — sync live, reconcile passing`.

---

## Out of this plan (next plans, written after the parity inventory)

- **P1b** parity inventory (`mdb-reader` over copies in `D:\extracted\access\`, plus the Erin/Vincent questions): its own short plan.
- **P2:** public directory + Entra SSO + staff admin modules.
- **P3:** licensee portal (TOTP) + Payflow + reports.
- **P4/P5:** UAT, rehearsals, cutover runbook, plus the security track (spec §8): scope firewall rule 1433 to Tailscale + 72.32.176.56, remove the router port-forward, and rotate credentials.

## Orchestrator pre-steps (done by the coordinating session before Task 1; these are not subagent tasks)

- Commit this plan.
- Publish the spec and plan to Outline under "Louisiana State Board of Dentistry (LSBD)", and add a pointer on "Plan 1: Assessment".
- Correct CLAUDE.md: the firewall, Vincent, the license identity, and the pointers to the spec and plan.

## User actions required (not agent tasks)

- Push `feat/lsbd-schema` to GitHub: provide a PAT here, or pull the branch from a dev box.
- Upgrade Supabase project `ynqprnuwoznpkrwfmtyx` to Pro and enable PITR.
- Ask Erin and Vincent the P1b questions (spec §5).
