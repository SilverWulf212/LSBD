# Runbook: database roles and the anon lockdown

Three hand-written SQL files move the site off the `postgres` role and close the
anon key's access to data. None of them is applied automatically.

| File | What it does | When it is safe |
| --- | --- | --- |
| `drizzle/0005_public_cms_lockdown.sql` | RLS on every table in `public`; revokes anon / authenticated on them | Any time |
| `drizzle/0006_db_roles.sql` | Creates `lsbd_app` and `lsbd_staff_ro` (no login), their grants and policies | Any time (additive) |
| `drizzle/0007_public_view_owner_rights.sql` | Makes `public.public_licensee` an owner-rights view, adds `legacy_key`, removes every anon grant and policy on licensing data | **Only after** the server-side verify pages are deployed everywhere |

All three are idempotent. Each runs in one transaction and rolls back completely
on the first error. The runner holds the sync advisory lock, so it waits for a
running sync cycle to finish and the next cycle waits for it; do not pause the
scheduled tasks.

## 1. Apply, in this order

Run from `C:\Users\Administrator\LSBD-work\LSBD`. After each file, run the check;
it prints `PASS` / `FAIL` lines with counts only and exits 1 on any failure.

```powershell
npx tsx scripts/apply-sql.ts drizzle/0005_public_cms_lockdown.sql
npx tsx scripts/verify-rls.ts --stage=0005

npx tsx scripts/apply-sql.ts drizzle/0006_db_roles.sql
npx tsx scripts/verify-rls.ts --stage=0006
```

0005, 0006 and 0007 each take ACCESS EXCLUSIVE locks for the length of their
transaction (a few seconds): 0005 on every table in `public`, 0006 on every table
in `public` and on the allow-listed `lsbd` tables (creating a policy needs the
lock), 0007 on the view, `lsbd.license` and `lsbd.person`. Site queries on those
tables wait meanwhile, so apply outside busy moments.

Then stop until the gate below is met.

**Gate for 0007:** the build in which `/verify` reads `public.public_licensee`
through the server connection (commit `c7176b6` or later) is deployed to **every**
environment that serves verify: Production and any Preview that people use. An
older deployment still reads the view with the anon key and will show no results
once 0007 is applied.

```powershell
npx tsx scripts/apply-sql.ts drizzle/0007_public_view_owner_rights.sql
npx tsx scripts/verify-rls.ts --stage=0007
```

Then load `/verify` on the live site and search a known name.

The stages are cumulative (`--stage=0006` repeats the 0005 checks). With no flag
the script runs everything, which is the check to use from then on.

0007 starts with a guard: it refuses to run unless the view's owner bypasses RLS
or owns `lsbd.license` and `lsbd.person`. Without that the view would return no
rows for anyone.

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

## 2. Give the roles a login

0006 creates both roles `NOLOGIN` with no password. Passwords never go in a file
in the repo.

1. Generate two long random passwords (letters and digits only, so they need no
   URL-escaping) and store them in the password manager.
2. In the Supabase dashboard SQL editor (or `psql`, where `\password lsbd_app`
   avoids typing the password into a statement):

   ```sql
   ALTER ROLE lsbd_app      LOGIN PASSWORD '<password 1>';
   ALTER ROLE lsbd_staff_ro LOGIN PASSWORD '<password 2>';
   ```

3. Build the pooler URLs. Through the Supabase pooler the user name is
   `<role>.<projectref>`; host and database are the same as the existing
   `POSTGRES_URL`. Use the transaction pooler (port 6543) for the site:

   ```
   postgresql://lsbd_app.<projectref>:<password 1>@aws-1-us-west-1.pooler.supabase.com:6543/postgres
   postgresql://lsbd_staff_ro.<projectref>:<password 2>@aws-1-us-west-1.pooler.supabase.com:6543/postgres
   ```

Both roles have `statement_timeout = 30s` set on the role.

## 3. Vercel variables

| Variable | Connects as | Used for |
| --- | --- | --- |
| `POSTGRES_URL` | `lsbd_app` | CMS, admin, public verify, sync status |
| `LSBD_RO_URL` | `lsbd_staff_ro` | Staff read-only views of licensing data |

Set both on **Preview first**, redeploy the preview, and exercise: login, an admin
edit, `/verify`, the sync status panel. Only then set them on Production and
redeploy. Keep the old `POSTGRES_URL` value at hand until Production is confirmed;
putting it back and redeploying is the rollback.

Do not point `POSTGRES_URL` at `lsbd_app` before 0007 is applied: until then the
view runs with the caller's rights and `lsbd_app` has none on schema `lsbd`, so
verify would fail.

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
and cannot do. It briefly locks the CMS tables and every `lsbd` table (several
seconds), so run it outside busy moments.

```powershell
$env:LSBD_IT='1'; npx vitest run tests/it/grants.test.ts --no-file-parallelism
```
