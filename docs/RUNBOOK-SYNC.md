# LSBD Sync — Operator Runbook

One-way interim sync: **SQL Server LSBDDB (VM LSBDSQL) → Supabase `lsbd_raw.*` → `lsbd.*`**. It runs until cutover, and afterwards for as long as member-base.net still writes to SQL Server (payments toggle in `memberbase` mode; see `docs/superpowers/specs/2026-10-01-lsbd-payments-findings-and-plan.md` §4).

Spec: `docs/superpowers/specs/2026-09-30-lsbd-migration-cutover-design.md`. Plan: `docs/superpowers/plans/2026-09-30-lsbd-p0-p1-sync-engine.md`.

## 1. What runs, where

| Task (Task Scheduler, runs as SYSTEM) | When | What |
|---|---|---|
| `LSBD Sync Quick` | every 15 min, 07:00–19:00, Mon–Fri | Diff sync of changed tables, then incremental transforms |
| `LSBD Sync Weekend` | hourly, 07:00–19:00, Sat–Sun | Same as Quick |
| `LSBD Sync Full` | daily 02:00 | Full diff of all tables, all transforms, then **reconcile** |

- **Code:** runs only from the release worktree `C:\ProgramData\lsbd-sync\app`, which is pinned to a tag (`sync-vN`; current: **sync-v5**). Never from the dev copy.
- **Secrets:** `C:\ProgramData\lsbd-sync\secrets.env` (SYSTEM + Administrators only). Never print or commit them.
- **Logs:** `C:\ProgramData\lsbd-sync\logs\<task>-<yyyyMMdd-HHmm>.log` (30-day retention). Errors also go to the Windows Application event log, source `LSBD-Sync`.
- **Reconcile reports:** `C:\ProgramData\lsbd-sync\reports\reconcile-<yyyyMMdd-HHmm>.md`.
- **Run history:**
  - In the DB: `lsbd_raw._sync_runs` and `lsbd_raw._sync_tables`.
  - In the app: `/admin/sync` (admin only). It shows a red banner if the last ok run is more than 2 h old during weekday business hours.
- **Alerting:** set `SYNC_HEALTHCHECK_URL=` in the secrets file (a healthchecks.io ping URL). **Until it is set, nobody is alerted on failure.**

### Bridge safety (do not weaken)
Every SQL Server query:
- goes over Hyper-V PowerShell Direct,
- runs as `EXECUTE AS USER 'lsbdverify'` (read-only),
- runs inside `READ UNCOMMITTED; BEGIN TRAN … ROLLBACK`,
- passes a keyword guard first.

**MSSQL is read-only to this system.**

## 2. Routine checks

| Check | How | Healthy |
|---|---|---|
| Tasks enabled | `Get-ScheduledTask 'LSBD Sync*' \| Get-ScheduledTaskInfo` | State Ready; LastTaskResult 0 |
| Recent runs | `/admin/sync`, or `select * from lsbd_raw._sync_runs order by id desc limit 20` | `status = ok` every 15 min in business hours |
| Nightly reconcile | newest `reports\reconcile-*.md` | `Result: **PASS 80/80**` |

**Reconcile timing matters.**
- Run it **off-hours**; the nightly 02:00 run is the acceptance evidence.
- During business hours a table can show off by 1 row. That is the raw copy lagging a live staff edit by a few minutes, not a fault. Re-check after the next quick run.
- Run manually from the release worktree:
  ```powershell
  cd C:\ProgramData\lsbd-sync\app; npm run sync:reconcile
  ```

## 3. Common operations (run elevated)

**Pause / resume all sync tasks.** Always bracket integration tests (`npm run test:it`) with these. Pause waits for a run in progress.
```powershell
powershell -ExecutionPolicy Bypass -File scripts\sync\pause-tasks.ps1 -Pause
powershell -ExecutionPolicy Bypass -File scripts\sync\pause-tasks.ps1 -Resume
```

**Release new sync code.**
1. Commit first; the script refuses a dirty tree.
2. Run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\sync\release.ps1 -Tag sync-v6
   ```
   It pauses the tasks, tags, checks out the tag in the worktree, runs `npm ci`, and resumes. On any failure it rolls back to the previous commit.

**Apply changed transform SQL** (`supabase/transforms/*.sql`) to the database:
```powershell
cd C:\ProgramData\lsbd-sync\app; npm run sync:transforms:apply
```

**Manual runs** (from the release worktree):
```powershell
npx tsx scripts/sync/run.ts --mode quick            # diff changed tables + transforms
npx tsx scripts/sync/run.ts --mode full             # all tables + all transforms
npx tsx scripts/sync/run.ts --tables none           # transforms only (all domains)
npx tsx scripts/sync/run.ts --mode full --no-transform
```

**Re-install or refresh the tasks** (e.g. after rotating secrets):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\sync\install-task.ps1 -RefreshSecrets
```

## 4. Failure playbooks

### 4.1 Run `status = blocked`: mass-delete guard at the raw layer
- **Symptom:** `_sync_runs.blocked_tables` lists a table, and the run exits with code 2.
- **Meaning:** the source returned far fewer rows than the mirror holds (more than 100 rows *and* more than 50% would be deleted). Usually a bad read: VM issue, empty result, or permissions.
- **Steps:**
  1. Check the source. Does LSBDDB really have that few rows? Ask staff/Vincent whether a purge was intended.
  2. If it was a bad read: fix the cause (VM, bridge) and let the next run retry. Do nothing else.
  3. If the purge is deliberate and confirmed: run once with the override:
     ```powershell
     npx tsx scripts/sync/run.ts --mode full --tables <Table> --allow-mass-delete
     ```

### 4.2 Transform fails with `mass delete blocked on lsbd.<table>: X of Y rows`
- **Meaning:** the DB-level guard in `lsbd._delete` stopped a transform from deleting more than 50% of a normalized table.
- **Important:** `--allow-mass-delete` currently does **not** reach this guard. The `run.ts` wiring for it (`withMassDeleteOverride` around the `runTransforms` call, `run.ts` ~line 725) is pending; the edit was blocked for the agent and is left to the user.
- **Steps:**
  1. Confirm the deletion is real. Compare `lsbd_raw."<Source>"` live rows against MSSQL, and ask staff.
  2. If deliberate, run the transforms once on a single session with the override (psql or any SQL client on the **session pooler, port 5432**):
     ```sql
     SET lsbd.allow_mass_delete = 'on';
     CALL lsbd.run_transforms(NULL, 0);   -- all domains
     RESET lsbd.allow_mass_delete;
     ```
  3. Check the result: `select * from lsbd_raw._sync_runs order by id desc limit 3;` and the next quick run is `ok`.
  4. Never leave the setting on. It is session-scoped, so close the session.

### 4.3 Run `failed`
1. Read the newest log in `logs\`, plus `_sync_runs.error` (it is redacted).
2. **Bridge/VM errors:** check that VM `LSBDSQL` is Running, and that PowerShell Direct works from this host (CLAUDE.md "How to talk to the SQL VM").
3. **Supabase errors:**
   - Use the pooler `aws-1-us-west-1.pooler.supabase.com` (5432 session / 6543 transaction). The direct host is IPv6-only and unreachable from here.
   - Check the Supabase status page.
4. After a failed run, the next run automatically re-runs **all** transforms.

### 4.4 Schema drift
- **Symptom:** `_sync_runs.schema_drift` is non-empty, meaning a source table gained, lost or retyped columns.
- The runner keeps syncing known columns. To adopt a change: update the raw DDL/policy, release, then run `--mode full` for that table.

### 4.5 Advisory lock busy
- Only one run at a time (`pg_advisory_lock(hashtext('lsbd_sync'))`). A run that overlaps another exits quietly.
- An abandoned run (crash) is recovered and marked failed on the next start.

## 5. Data rules (do not "fix" these)
- **License identity is `tblDenHyg.Key`.** Dentist, hygienist and EDDA license numbers overlap, so never dedupe on `license_id`.
- **"Lookup, not gate":**
  - A missing parent leaves the FK NULL; the row is never dropped.
  - Example: 1,926 `office_affiliation` rows reference offices that don't exist. They load with `office_id` NULL, and the source `OFFICE_ID` stays in `lsbd_raw`.
- **SSN:** HMAC-SHA256 only, stored only in `lsbd.licensee_pii`. Passwords are dropped. Never import `VSAuth` / `VsCapture` (card logs, purged at source) or `dtproperties`.
- **Time zone:** source datetimes are naive Central and are stored via `AT TIME ZONE 'America/Chicago'`.
- **Money** is `numeric`. Transaction sums equal raw exactly.

## 6. Known caveats
- Integration tests write synthetic bookkeeping rows into the same `lsbd_raw._sync_runs` table: synthetic keys ≥ 900000000, and `blocked`/`failed` test runs. Expect them in `/admin/sync` around test windows. A separate test database (Supabase branch) is the deferred fix.
- Business-hours reconcile can race staff edits; trust the 02:00 report.
- At cutover, SQL Server is retired for staff. It stays up as member-base.net's write target while the payments toggle is `memberbase`, and this sync keeps pulling those writes until the toggle flips and member-base.net is off.
