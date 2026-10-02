# Runbook: database roles and the anon lockdown

Three hand-written SQL files move the site off the `postgres` role and close the
anon key's access to data. None of them is applied automatically.

**Scope: the database and the Preview environment only.** Production is Stage 0b
of the P2 plan, a supervised promotion (CMS re-copy from Neon, admin promotion,
then environment variables and deploy). Do not set Production variables and do not
redeploy `main` from this runbook.

| File | What it does | When it is safe |
| --- | --- | --- |
| `drizzle/0005_public_cms_lockdown.sql` | RLS on every table in `public`; revokes anon / authenticated on them | Any time |
| `drizzle/0006_db_roles.sql` | Creates `lsbd_app` and `lsbd_staff_ro` (no login), their grants and policies | Any time (additive) |
| `drizzle/0007_public_view_owner_rights.sql` | Makes `public.public_licensee` an owner-rights view, adds `legacy_key`, removes every anon grant and policy on licensing data | **Only after** the gate in §1 is met |

All three are idempotent. Each runs in one transaction and rolls back completely
on the first error. The runner refuses a file that contains its own `BEGIN;`,
`COMMIT;` or `ROLLBACK;`.

The runner holds the sync advisory lock. It waits for a sync run in progress to
finish; a sync run that starts while a file is being applied **skips** (lock busy)
and the next run catches up. Do not pause the scheduled tasks, and do not apply
near the 02:00 nightly full sync + reconcile.

## 1. Apply, in this order

Run from `C:\Users\Administrator\LSBD-work\LSBD`. After each file, run the check;
it prints `PASS` / `FAIL` lines with counts only and exits 1 on any failure.

```powershell
npx tsx scripts/apply-sql.ts drizzle/0005_public_cms_lockdown.sql
npx tsx scripts/verify-rls.ts --stage=0005
```

After 0005, on the Preview deployment: load the home page and `/news`, sign in,
and save one CMS edit. That confirms the app's own connection still reads and
writes.

```powershell
npx tsx scripts/apply-sql.ts drizzle/0006_db_roles.sql
npx tsx scripts/verify-rls.ts --stage=0006
```

**After each file** (0005, 0006 and 0007): confirm the next quick sync is `ok` on
`/admin/sync`.

### Locks taken during an apply

Each file takes ACCESS EXCLUSIVE locks for the length of its transaction (a few
seconds). Site queries on the locked tables wait meanwhile, so apply outside busy
moments.

| File | Locked |
| --- | --- |
| 0005 | every table in `public` (the CMS tables, `users`, `audit_log`) |
| 0006 | every table in `public`; the allow-listed `lsbd` tables (creating a policy needs the lock); `lsbd_raw._sync_runs` and `lsbd_raw._sync_tables` |
| 0007 | the view `public.public_licensee`, `lsbd.license` and `lsbd.person` |

The `lsbd` tables that are not on the allow-list are not locked by any of the
three files.

### Gate for 0007

Stop here until the gate is met: **no Preview still in use may run code older
than commit `c7176b6`.** From that commit on, verify reads
`public.public_licensee` through the server connection; older code reads the view
through the anon key and would show no results once 0007 is applied.

```powershell
npx tsx scripts/apply-sql.ts drizzle/0007_public_view_owner_rights.sql
npx tsx scripts/verify-rls.ts --stage=0007
```

Then load `/public/verify` on the **Preview** deployment and search a known name.

For `public_licensee` the check passes with `not visible to anon (PGRST205)`:
after 0007 anon has no privilege on the view, so PostgREST hides the relation
instead of answering permission denied. If a copy of the script from before that
change prints `unchecked: error PGRST205` for `public_licensee`, that is the same
thing, not exposure. For `users`, `audit_log` and `posts` that code stays a FAIL.

The stages are cumulative (`--stage=0006` repeats the 0005 checks). With no flag
the script runs everything, which is the check to use from then on.

0007 starts with a guard: it refuses to run unless the view's owner bypasses RLS
or owns `lsbd.license` and `lsbd.person`. Without that the view would return no
rows for anyone.

### After all three

- The nightly reconcile still passes (check the morning after).
- `/api/search?q=<a draft title>` on the Preview returns no draft.
- The six-role check on the Preview: signed in as each of `admin`, `staff`,
  `discipline`, `finance`, `inspector`, `board`, only `admin` and `staff` can
  write CMS content.

### Rollback of 0007

Use this if, after 0007, a deployment is found that still reads verify with the
anon key (its verify pages show no results). It restores the state of
`drizzle/0002_rls.sql` lines 41-89: anon's `USAGE` on schema `lsbd`, its column
grants and two policies on `lsbd.license` / `lsbd.person`, and the caller-rights
view readable by anon. The whole of 0002 is idempotent, so re-apply the file,
then 0006 (0002 drops and recreates the view, which removes `lsbd_app`'s grant
on it):

```powershell
npx tsx scripts/apply-sql.ts drizzle/0002_rls.sql
npx tsx scripts/apply-sql.ts drizzle/0006_db_roles.sql
npx tsx scripts/verify-rls.ts --stage=0006
```

After the rollback:
- the view has its 12 original columns again (no `legacy_key`);
- the view runs with the caller's rights, so a site connected as `lsbd_app`
  cannot read it: `POSTGRES_URL` must be the `postgres` URL until 0007 is
  re-applied;
- `verify-rls.ts --stage=0007` fails, by design. Fix the old deployment, then
  apply 0007 again.

`tests/it/grants.test.ts` exercises this rollback (inside its rolled-back
transaction).

## 2. Give `lsbd_app` a login

0006 creates both roles `NOLOGIN` with no password. Passwords never go in a file
in the repo.

**Only `lsbd_app` gets `LOGIN` and a password at this stage. Leave
`lsbd_staff_ro` `NOLOGIN` for now:** nothing reads `LSBD_RO_URL` until Stage 2,
and which free-text columns that role may read is undecided.

1. Generate one long random password (letters and digits only, so it needs no
   URL-escaping) and store it in the password manager.
2. In the Supabase dashboard SQL editor (or `psql`, where `\password lsbd_app`
   avoids typing the password into a statement):

   ```sql
   ALTER ROLE lsbd_app LOGIN PASSWORD '<password>';
   ```

3. Build the pooler URL. Host and database are the same as the existing
   `POSTGRES_URL`; use the transaction pooler (port 6543) for the site:

   ```
   postgresql://lsbd_app.<projectref>:<password>@aws-1-us-west-1.pooler.supabase.com:6543/postgres
   ```

4. **Test the `lsbd_app` login through the pooler before changing any Vercel
   variable.** Two things are **unverified** for a custom role on this project:
   - the pooler user name format `<role>.<projectref>`;
   - whether the role-level `statement_timeout = 30s` (set by 0006) takes effect
     through port 6543.

   Connect with the URL and run `SELECT current_user; SHOW statement_timeout;`.
   If the login fails, stop and leave Vercel alone. If the timeout is not `30s`,
   record what it is before going on.

## 3. Vercel variables (Preview only)

**Do not point `POSTGRES_URL` at `lsbd_app` before 0007 is applied.** Until then
the view runs with the caller's rights and `lsbd_app` has none on schema `lsbd`,
so verify would fail.

| Variable | Connects as | Used for | Set now? |
| --- | --- | --- | --- |
| `POSTGRES_URL` | `lsbd_app` | CMS, admin, public verify, sync status | Preview only, after 0007 and the login test in §2 |
| `LSBD_RO_URL` | `lsbd_staff_ro` | Not used. The staff screens read through `POSTGRES_URL` and `SET LOCAL ROLE lsbd_staff_ro` (`src/lib/db/lsbd-ro.ts`), so this role never needs a login | No |

**Before that switch, `lsbd_app` must be allowed to become `lsbd_staff_ro`.** The
staff screens run `SET LOCAL ROLE lsbd_staff_ro` on the app connection, and 0006
grants that role to `postgres` only. Without the grant every staff page shows its
error box. The grant must give SET without INHERIT:

```sql
GRANT lsbd_staff_ro TO lsbd_app WITH INHERIT FALSE, SET TRUE;
```

A plain `GRANT lsbd_staff_ro TO lsbd_app` would let `lsbd_app` read the staff tables
all the time (roles inherit by default), which defeats "nothing in schema `lsbd`"
in §4. This needs a small SQL file applied with `scripts/apply-sql.ts`, plus a
`verify-rls.ts` check that `lsbd_app` still cannot `SELECT` from `lsbd.license`
without `SET ROLE`; neither is written yet.

Set `POSTGRES_URL` on **Preview**, redeploy the preview, and exercise: login, an
admin edit, `/public/verify`, the sync status panel. Keep the old value at hand;
putting it back and redeploying the preview is the rollback.

Production variables and the production deploy are Stage 0b (see the top of this
file); do not set them or redeploy `main` here.

Sync, migrations and `scripts/*` keep using `SUPABASE_DB_URL_SESSION` (the
`postgres` role). Nothing changes for them.

## 4. What each role can do

`lsbd_app`
- `SELECT, INSERT, UPDATE, DELETE` on every table in `public`, except
  `audit_log`, which is `SELECT, INSERT` only (the app cannot alter or delete
  audit rows).
- `SELECT` on `public.public_licensee`.
- `SELECT` on `lsbd_raw._sync_runs` and `lsbd_raw._sync_tables`.
- Nothing in schema `lsbd`.

`lsbd_staff_ro`
- `SELECT` only, on the tables listed by name in `0006_db_roles.sql`.
- `lsbd.individual` is granted by column, without `ssn`, `dob`, `sex`, `race`. A
  query that names those columns, or uses `SELECT *` on that table, is refused.
- Never: `licensee_pii`, `users`, `logins`, `person_practice_stats`, transactions,
  renewals, complaints, `vs_*`, `_src_*`, `_transform_*`.

## 5. Rule: a new table needs an explicit grant

Neither role bypasses RLS and there are no default privileges for them, so a new
table is invisible to the site until it is granted.

- **New CMS table in `public`:** in its migration, enable RLS and add the grant
  and the policy:

  ```sql
  ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO lsbd_app;
  CREATE POLICY lsbd_app_all ON public.<table> FOR ALL TO lsbd_app USING (true) WITH CHECK (true);
  -- only if the table has a serial / identity column:
  GRANT USAGE, SELECT ON SEQUENCE public.<table>_id_seq TO lsbd_app;
  ```

  Re-applying `0006_db_roles.sql` does the grant, policy and sequence steps for
  every table in `public` (it does not enable RLS).
- **New `lsbd` table staff should read:** add its name to the list in
  `0006_db_roles.sql` and to `scripts/lib/staff-ro-tables.ts` (the check compares
  the two through the catalog), then re-apply. Check the "never" list first.
  0006 revokes everything from `lsbd_staff_ro` in `lsbd` before granting, so
  removing a name from the list removes the access on re-apply.

The symptom of a missed grant is `permission denied for table <table>`; a missed
policy shows as empty results with no error.

## 6. Test before applying

`tests/it/grants.test.ts` runs 0005, 0006 and 0007 against the live database
inside one transaction that is always rolled back, and asserts what each role can
and cannot do. For several seconds it holds every lock in the §1 table at once:
every table in `public`, the allow-listed `lsbd` tables, the two `lsbd_raw`
status tables and the view. Run it outside busy moments and not near 02:00.

`docs/RUNBOOK-SYNC.md` §3 says to pause the sync tasks around integration tests;
this test instead takes the sync advisory lock itself, as the runner does, so it
needs no pause (a sync run that starts meanwhile skips and the next catches up).

```powershell
$env:LSBD_IT='1'; npx vitest run tests/it/grants.test.ts --no-file-parallelism
```
