# LSBD Database Migration, Interim Sync, and Cutover — Design

**Date:** 2026-09-30
**Status:** Approved in conversation 2026-09-30; spec awaiting review
**Supersedes:** the overlapping parts of Outline "LSBD DB Migration — Plan 1: Assessment" (2026-09-28). Most of that assessment was already done on LSBDserver in May 2026 (see "Current state").

## 1. Intended outcome

The Louisiana State Board of Dentistry runs its licensing operations on a legacy
SQL Server 2017 database (`LSBDDB` on the Hyper-V VM `LSBDSQL`), with staff using
an MS Access front-end (`lsbdapp.mdb`) and the public/licensees using a
vendor portal (member-base.net / membersbase.com). This project replaces all of it with
Supabase (Postgres) + the Next.js site (`lsbd-sigma.vercel.app` → `lsbd.org`),
with Microsoft sign-in.

Success means:

1. **Full cutover.** On go-live day staff stop using Access; MSSQL goes read-only
   and is later decommissioned. Supabase becomes the system of record.
2. **Parity.** Everything the old system does, the new one does: public license
   verification, public directory browse, staff admin over every live table,
   licensee self-service portal, online card payments (PayPal Payflow), and the
   reports staff rely on.
3. **No data lost.** From now until cutover a scheduled one-way sync keeps
   Supabase current with MSSQL, so the new site is always being built and tested
   on fresh data and the go-live load is just the final sync run.
4. **Provably correct conversion** (Amendment 2 acceptance criteria):
   100% row-count match per migrated table; per-table checksum match; Erin signs
   off a 50-record random spot-check; one Supabase restore completed and verified.

**Timeline:** functional well before go-live; target cutover **~Nov 18–20, 2026**
(before Thanksgiving). December is buffer. Hard deadline **January 2027**.
2026 is an off-year for the biennial renewal cycle, so the window is quiet.

## 2. Decisions (from the user, 2026-09-30, plus prior Outline decisions)

| Topic | Decision |
|---|---|
| End state | Full cutover at go-live; Access + MSSQL retired (MSSQL kept read-only 90 days, decommissioned after written sign-off). |
| Supabase project | Keep existing `ynqprnuwoznpkrwfmtyx` (us-west-1). Wipe the stale May 2026 data. Upgrade to Pro + PITR before go-live. |
| Site scope at go-live | Public verify, public directory browse, staff admin, licensee portal — "everything the old one did/does, but with MS auth". |
| Staff auth | Entra ID SSO (M365 tenant lsbd.org), MFA via Microsoft Authenticator; staff roles from Entra groups. |
| Licensee auth | Supabase account + required TOTP (Microsoft Authenticator app). |
| Payments | Keep PayPal Payflow, via Payflow hosted pages + Secure Token, so card data never touches our servers. |
| Access control | Postgres RLS. |
| Data path | VM → LSBDserver host → Supabase. Row data never passes through a dev Mac or GitHub. |

## 3. Current state (verified 2026-09-30)

- **Source.** SQL Server 2017 **Standard** 14.0.2095.1, DB `LSBDDB`, 82 tables,
  ~600k rows, 144 MB data. Actively written by staff today. 74 tables have a
  PK; 8 have none (Activity, Control, Specialty, Statutes, StatuteViolations,
  tblSedLevels, VSAuth, VsCapture). No FKs, no Change Tracking/CDC enabled.
  Only Agent job: `syspolicy_purge_history`. No linked servers.
- **Source consumers.**
  - Staff Access front-ends over Tailscale (100.x addresses) as `lsbddbuser`.
  - `1008364-APP9` (Rackspace, 72.32.176.56): IIS as `lsbdverify` (read-only, deny-writer), which is almost certainly the member-base.net verification or portal. Also SSMS as `lsbddbuser`: Vincent, the DB admin. The user considers this activity clean.
- **Network.** VM firewall rule "1433 TCP Allow Any" is enabled; the VM is on Tailscale.
  72.32.176.56 reaches 1433 from the internet, so an office router port-forward
  is likely. (CLAUDE.md's "firewall blocks all inbound" is wrong.) The Hyper-V
  host cannot reach 1433 over TCP; PowerShell Direct (VMBus) works.
- **Payments data.** VSAuth/VsCapture (Payflow auth/capture logs, masked PANs +
  cardholder name/address/expiry) were purged at the source by Vincent on 2026-09-30.
  Our May copies still exist in Supabase `lsbd.vs_auth`/`vs_capture` and
  `D:\extracted\data\VSAuth.jsonl`/`VsCapture.jsonl`.
- **Target.** Supabase has 86 `lsbd` tables + 13 `public` CMS tables, loaded
  from a **2026-05-12** snapshot (stale: e.g. tblDenHyg 19,070 → 19,285 rows).
- **Repo.** Branch `feat/lsbd-schema` (unpushed), commits through
  `45f6577` (Packages A auth, B-1…B-4 ETL, C RLS, G /verify). The existing ETL is
  wipe-and-insert / `ON CONFLICT DO NOTHING`, so it cannot apply deltas. No test framework.
- **Parallel session.** A Mac Claude session owns the Outline "Plan 1" docs and
  has its own clone of the repo. It needs this branch pushed and this spec.

## 4. Architecture

```
LSBDSQL (MSSQL — system of record until cutover; never modified by us)
   │  PowerShell Direct (VMBus). Read-only SELECTs only.
   ▼
LSBDserver: sync runner  (Node/tsx, Task Scheduler as SYSTEM)
   │  - column policy applied here (SSN → HMAC, passwords dropped)
   │  - Postgres advisory lock prevents overlapping runs
   ▼
Supabase  lsbd_raw.*     1:1 mirror of LSBDDB (source names, mapped types)
   │                     + _row_hash, _synced_at, _deleted_at per row
   │                     + _sync_runs, _sync_tables bookkeeping
   │  lsbd.run_transforms()  — set-based SQL inside Postgres
   ▼
Supabase  lsbd.*         normalized app schema (existing 86 tables), RLS
   ▼
Next.js on Vercel: /verify, /directory, /admin (Entra SSO), /portal (TOTP), Payflow
```

### 4.1 Sync engine: snapshot + hash diff (three tiers)

Chosen over SQL Server Change Tracking (alters prod, needs PKs everywhere) and
timestamp-incremental (only ~25 tables have `Updated`, deletes invisible).

1. **Fingerprint** (every run, all tables, one round-trip): per table
   `COUNT_BIG(*)` and `CHECKSUM_AGG(BINARY_CHECKSUM(*))`. This is cheap, but
   `BINARY_CHECKSUM` ignores ntext/image columns. An edit that touches only
   those columns is therefore picked up by the nightly full run, not the
   15-minute run. If both values match those stored in `lsbd_raw._sync_tables`
   from the previous run, the table is skipped.
2. **Keys** (changed tables only): fetch `(pk…, row_hash)` for every row; diff
   against `lsbd_raw.<t>(pk, _row_hash)` → inserts, updates, deletes.
3. **Rows** (changed keys only): fetch full rows for inserted/updated keys,
   apply the column policy, upsert into `lsbd_raw.<t>`. Deleted keys get
   `_deleted_at = now()` (soft delete; the transform treats them as gone).

- **Full mode** (nightly 02:00 and on demand) skips tier 1 and runs tiers 2–3 for
  every table. This is the reconciliation pass and produces the acceptance evidence.
- **Quick mode** runs every 15 minutes, 07:00–19:00, Monday–Friday.
- **No-PK tables** (all tiny) are fully replaced inside a transaction each run.
- **Excluded tables:** `VSAuth`, `VsCapture` (card data; purged at source; the new Payflow flow writes new tables), and `dtproperties` (a system table).
- **Excluded databases:** `LSBD_DEV` and `LSBDBAK`. They are archived as a `.bak` at cutover and not migrated.

**Row hash canonicalisation (T-SQL, generated per table from `sys.columns`):**
each column becomes `ISNULL(<text form>, NCHAR(9216))` (U+2400, written as NCHAR so it survives any transport encoding) joined with `NCHAR(31)`, hashed
with `HASHBYTES('SHA2_256', …)`. The text forms are:

| Type | Text form |
|---|---|
| datetime, smalldatetime | `CONVERT(nvarchar(30), c, 126)` |
| float | `CONVERT(nvarchar(30), c, 3)` |
| money | `CONVERT(nvarchar(40), c, 2)` (style 2 keeps all 4 decimal places; style 0 would round to 2) |
| decimal | `CONVERT(nvarchar(40), c)` |
| ntext | `CAST(c AS nvarchar(max))` |
| image | `CONVERT(nvarchar(max), CAST(c AS varbinary(max)), 2)` |
| uniqueidentifier | `CONVERT(nvarchar(36), c)` |
| bit, integers | `CONVERT(nvarchar(20), c)` |
| character types | the value as-is |

Hashes only ever compare source against a previous source hash, so Postgres never needs to reproduce them.

**Type mapping (MSSQL → lsbd_raw):**

| MSSQL | Postgres |
|---|---|
| nvarchar, varchar, nchar, char, ntext | `text` |
| int | `integer` |
| smallint, tinyint | `smallint` |
| bit | `boolean` |
| datetime, smalldatetime | `timestamp` |
| money, decimal | `numeric` |
| float | `double precision` |
| uniqueidentifier | `uuid` |
| image | `bytea` |

Column names are kept verbatim (quoted).

**Column policy (applied on LSBDserver before upload):**

| Column | Policy |
|---|---|
| `tblDenHyg.SSN`, `Individual.SSN`, `tblRndDentists.SSN`, `tblRndHygienists.SSN` | `hmac`: normalise to 9 digits, then base64 HMAC-SHA256 with `PII_SSN_HMAC_KEY` (same function as `scripts/etl-b2-pii.ts`) |
| `tblDenHyg.password`, `Users.Password` | `drop` (never leaves the host) |

The row hash is still computed on the source's plaintext, so change detection stays exact.

### 4.2 Transform layer

- **Language.** `lsbd.run_transforms()` is a plpgsql procedure that calls one function per domain (`transform_lookups`, `transform_geography`, `transform_entities`, `transform_pii`, `transform_relationships`, `transform_operational`, `transform_financial`, `transform_compliance`). Each one is a set-based port of the column mappings in the existing `scripts/etl-b1*.ts` … `etl-b4.ts` and `etl-tbldenhyg.ts`, which remain the reference for mappings.
- **Upserts.** Each function upserts from `lsbd_raw` (rows where `_deleted_at IS NULL`) into `lsbd.*` with `INSERT … ON CONFLICT (<legacy key>) DO UPDATE … WHERE (target) IS DISTINCT FROM (excluded)`, so unchanged rows are not rewritten.
- **Deletes.** Each function then deletes `lsbd.*` rows whose legacy key is no longer live.
- **Order.** Upserts run parents → children; deletes run children → parents. Everything happens in one transaction, so readers never see a half-applied state.
- **Stable keys.** Every `lsbd` table must have a unique **legacy key**: the source PK, or for the `tblDenHyg` split, `license_id` / the source row key. Tables whose PK is generated with no legacy key get a `legacy_id` column plus a unique constraint (migration `0001`). App-facing IDs must stay stable across runs.
- **Orphans.** The source has no FKs, but `lsbd` does. Orphan children are skipped and counted in the run report; they are not fatal.
- **Time zones.** MSSQL datetimes are naive America/Chicago local time. `lsbd_raw` keeps them as `timestamp`, and every conversion into `lsbd` `timestamptz` uses `AT TIME ZONE 'America/Chicago'`. The May ETL did a bare cast, which shifted dates by 5–6 hours.
- **Deletes use `NOT EXISTS`, never `NOT IN`.** With `NOT IN`, a NULL key in the subquery silently deletes nothing.
- **Incremental transforms.** Quick mode runs only the domains whose source tables changed, looked up in `lsbd._transform_registry`. Full mode runs every domain.

### 4.3 Bookkeeping, monitoring, safety

- `lsbd_raw._sync_runs(id, started_at, finished_at, mode, status, tables_changed, inserted, updated, deleted, orphans_skipped, error)`.
- `lsbd_raw._sync_tables(table_name, source_count, source_fingerprint, raw_live_count, last_changed_at, last_synced_at)`.
- **Monitoring.** `/admin/sync` (staff-only) shows the last runs and per-table counts. The runner optionally pings `SYNC_HEALTHCHECK_URL` (healthchecks.io) after each successful run. Failures are written to the Windows Application event log (source `LSBD-Sync`).
- **Locking.** `pg_try_advisory_lock(hashtext('lsbd_sync'))`. A second concurrent run exits 0 with "already running".
- **Security of `lsbd_raw`.** `REVOKE ALL` from `anon` and `authenticated`, with RLS enabled and no policies. Only the `postgres` role (used by the runner and the transforms) can read it. It holds DOB and SSN-HMACs.
- **Secrets.** Moved to `C:\ProgramData\lsbd-sync\secrets.env`, readable by SYSTEM + Administrators only. The scheduled task runs as SYSTEM.
- **Release worktree.** The scheduled tasks run from `C:\ProgramData\lsbd-sync\app`, a git worktree pinned to a `sync-vN` tag. They never run from the dev working copy, so in-progress edits can't touch live data.
- **Bridge.** The bridge opens one persistent PowerShell Direct session per run. Every VM query is wrapped in `BEGIN TRAN … ROLLBACK` at READ UNCOMMITTED, which makes it impossible to commit a write to the source.
- **Schema drift.** A new source column triggers an automatic `ADD COLUMN`. Any other drift fails only the affected table, and the run records it.
- **Interim writes.** Until cutover the sync owns `lsbd.*`, so any UAT edit made in `/admin` is overwritten by the next transform (by design). `npm run uat:reset` re-runs transforms on demand.
- **Consistency.** Tables are snapshotted one at a time, so interim runs may see cross-table skew for a few seconds. The final cutover run happens with MSSQL read-only, so it is consistent.

### 4.4 Site integration (built in later plans)

- **Public** (`/verify`, `/directory`): reads a `lsbd.public_licensee` view that exposes only the legacy `directory_result.asp` fields (license #, name, type, status, action, dates, city/parish if staff approve), with ACT/PRB and D/H/EDDA filters. The anon key sees only this view.
- **Staff `/admin`:** Entra ID SSO through next-auth's Microsoft Entra ID provider. Modules follow the parity inventory (§5): licensees, permits, renewals, transactions, complaints/discipline, inspections, PLLCs, random audit sampling, education/exams, lookups, and reports/exports (including the "official list" sale).
- **Licensee `/portal`:** Supabase Auth with a required TOTP factor. Accounts are claimed with license # plus an SSN-last-4 or DOB challenge, checked against the HMAC/DOB in `licensee_pii`. Licensees view their record, update their address, and pay fees.
- **Payments:** Payflow Secure Token plus a hosted checkout page. The silent-post/return handler records results in new `lsbd.payment` tables. PAN, CVV and expiry are never stored.

## 5. Parity inventory (discovery, parallel with the sync build)

- **Access forms, queries and reports.** Extract the lists (and SQL for saved queries) from *copies* of `lsbdapp.mdb` and `ReportManager.accdb`, copied into `D:\extracted\access\`. `D:\Data\common` is never written. The copies are read with the pure-JS `mdb-reader` package (no ACE provider on this host).
- **Questions for Erin and Vincent:**
  1. Who operates member-base.net / membersbase.com / 1008364-APP9, and what exactly do its pages do?
  2. Are the Payflow merchant credentials still active, and what is paid online today?
  3. Which Access reports and processes are used monthly, at renewal, or never?
  4. Which Access users need which admin roles?
- **Output.** `docs/superpowers/specs/<date>-lsbd-parity-inventory.md`, one row per feature: old location, users, frequency, new home, priority (go-live / post-launch / drop). That inventory feeds the P2/P3 plans.

## 6. Phases and dates

| Phase | Window | Exit criteria |
|---|---|---|
| **P0 Housekeeping** | Sep 30 – Oct 3 | Stale `lsbd.*` data wiped (incl. vs_auth/vs_capture); `D:\extracted\data\*.jsonl` deleted; branch pushed; spec + plan in Outline; CLAUDE.md corrected; Supabase Pro+PITR ordered. |
| **P1 Sync + transform** | Oct 1 – Oct 14 | Scheduled sync live; full-mode run shows 100% count + key/hash match for every synced table; `lsbd.*` populated by transforms; lsbd-sigma /verify shows today's data. |
| **P1b Parity inventory** | Oct 1 – Oct 10 | Inventory doc approved by user (and Erin for priorities). |
| **P2 Public + staff admin core** | Oct 15 – Nov 4 | Directory + verify on live data; Entra SSO; admin modules for go-live-priority features. |
| **P3 Portal, payments, reports** | Oct 29 – Nov 11 | Licensee claim + TOTP; Payflow sandbox end-to-end; go-live reports reproduced. |
| **P4 UAT + rehearsals** | Nov 5 – Nov 18 | Erin UAT sign-off; two full dress rehearsals (wipe → full sync → transforms → acceptance checks) each passing; restore-from-PITR test passed. |
| **P5 Cutover** | target Nov 18–20 (fallback Dec; hard Jan) | See §7. |

## 7. Cutover runbook (outline; detailed runbook written in P4)

1. **T-7 days:** announce the freeze window to staff and Vincent. Confirm Payflow production credentials. Lower the DNS TTL to 300.
2. **T-0, 17:00:**
   1. Staff close Access.
   2. Take a full `.bak` of all 3 DBs (archive copy).
   3. `ALTER DATABASE LSBDDB SET READ_ONLY` (after a Hyper-V checkpoint).
3. **Final sync:** a full-mode run followed by `run_transforms()`.
4. **Acceptance:**
   1. Row counts 100%.
   2. Key/hash sets equal for every table.
   3. Erin's 50-record spot check against Access (still readable in read-only mode).
5. **Flip:**
   1. Switch the Vercel production env to go-live mode (enable writes in `/admin`, disable the scheduled sync task).
   2. Point `lsbd.org` DNS at Vercel.
   3. Remove the member-base.net redirect and links.
6. **Lock the old system:**
   1. Disable the `lsbddbuser` and `lsbdverify` logins.
   2. Rename the Access front-ends on staff machines.
   3. Remove the router port-forward and close firewall rule 1433.
   4. Rotate `LSBD1\sqladmin`.
7. **Rollback:** allowed until the first staff or licensee write lands in Supabase. To roll back, set MSSQL back to READ_WRITE, revert DNS, and re-enable the logins. After the first write we fix forward. MSSQL stays read-only for 90 days, then gets written sign-off and decommissioning.

## 8. Security track (low urgency, coordinated with Vincent)

- Before cutover, scope firewall rule "1433 TCP Allow Any" to the Tailscale CGNAT range (100.64.0.0/10) and 72.32.176.56, and confirm or remove the router port-forward.
- At cutover, rotate all three credentials (sqladmin, lsbddbuser, lsbdverify) and delete the plaintext copies: `lsbdapp.mdb` connection strings, the archived `.asp` files, and CLAUDE.md.
- Dispose of `D:\extracted\LSBDDB_20260512_085129.bak` (contains plaintext SSNs) at decommission, after written sign-off.

## 9. Out of scope

`DB_NCALB`/NCALBSERVER references; migrating `LSBD_DEV`/`LSBDBAK` (archived only);
two-way sync (never; full cutover instead); historical Payflow card logs.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Parity inventory reveals more Access functionality than 6 weeks allow | Inventory first; prioritise go-live vs post-launch with Erin; December buffer. |
| member-base.net operator unknown / uncooperative | Its read path is only `lsbdverify`; cutover disables it regardless. Our /verify replaces it. |
| PowerShell Direct throughput too slow for 15-min cadence | Tiered diff means only changed tables move; measure in P1; fall back to 30-min cadence. |
| Transform FK violations from source orphans | Skip + count orphans; review list with Erin before cutover. |
| Payflow product changes / credentials lost | Confirm in P1b; Stripe is the fallback (user decision needed then). |
