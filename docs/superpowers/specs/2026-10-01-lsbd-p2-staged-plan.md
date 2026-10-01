# LSBD P2 — staged plan: public directory + Entra SSO + read-only staff admin

## Context

P1 (sync engine) is finished except the night-2 reconcile (Oct 2 02:00). P2's window is
Oct 15 – Nov 4 and its plan was meant to wait for Erin/Vincent's inventory answers, which
have not arrived. Starting the parts that do not depend on those answers now buys about two
weeks of slack against the Nov 18–20 go-live.

**In scope:** `/directory`, Entra ID SSO for staff, **read-only** licensee and permit/firm
screens in `/admin`, and the security holes that must close before more staff can sign in.
**Out of scope until Erin replies:** renewals, fee engine, reports, complaints screens, any
edit screen. Payments admin is P3.

Hard rule (runbook §0/§6, spec §4.3): the sync engine owns `lsbd.*` until cutover, so every
admin screen over `lsbd.*` is read-only until the flip.

Repo `C:\Users\Administrator\LSBD-work\LSBD`. New branch `feat/p2-admin-core`, cut after
the P1 branch is finished (Oct 2). This plan was stress-tested by an independent review
against the code; its corrections are folded in below.

## Decisions (from Lance, 2026-10-01)

- **Password login:** break-glass only — off in production, on for local/preview behind `AUTH_ALLOW_CREDENTIALS=1`.
- **Directory fields:** name, type, status only. Office city/parish is built but switched off until Erin approves.
- **Staff roles:** answer was "it wont have links back to this server". **My reading:** sign-in and roles must not depend on this on-prem server or its Active Directory. Entra App Roles meet that: they live in the Microsoft 365 cloud tenant and the website talks only to Microsoft. The plan uses App Roles. If the meaning was "manage roles inside the site instead", only Stage 1's role source changes (Entra proves identity, `/admin/users` sets the role); say so at approval.

## Gaps found

| # | Gap | Evidence | Stage |
|---|-----|----------|-------|
| G1 | No RLS on any `public.*` CMS table. With Supabase's default grants the anon key may be able to read `public.users` (bcrypt hashes) and `audit_log`, and write `posts`, straight through PostgREST. **Unverified — first check of Stage 0** | no `ENABLE ROW LEVEL SECURITY` for `public` in any migration | 0 |
| G2 | CMS has no role checks: any signed-in role, including `board` "read-only", can create/edit/delete content and blobs. `/api/upload` is session-only | nine `src/actions/*.ts` files use a private `requireSession()`; `src/app/api/upload/route.ts:6-9` | 0 |
| G3 | `/api/search` is public and searches `posts` with no status filter, so draft titles and excerpts leak | `src/app/api/search/route.ts:14-25` | 0 |
| G4 | The app connects as the `postgres` superuser; RLS protects nothing on the admin path, including `lsbd.licensee_pii` | `HANDOFF.md:68` | 0 |
| G5 | `anon` holds column grants on base tables `lsbd.license` / `lsbd.person` including internal ids; `scripts/verify-rls.ts` treats any error (and 0 rows) as a pass | `drizzle/0002_rls.sql:41-62`; `verify-rls.ts:50-71` | 0 |
| G6 | Public verify: repeated query params and `/public/verify/%25E0` return 500; raw Supabase error text shown; `last_name=%%` matches everything; a 60 s CDN header covers search URLs | `src/lib/public-verify.ts:52-93`; `public-verify-helpers.ts:109-121`; `next.config.ts:45-53` | 0 |
| G7 | The migration runner continues on error, has no transaction, skips TLS verification, and ignores the sync lock. A half-applied migration could take verify down or fail a sync run | `scripts/apply-migration.ts:35,43-55` | 0 |
| G8 | Production (`main`) still runs on Neon with postgres.js. A production deploy today would point postgres.js at the 6543 pooler and hang; the only migrated user is `staff`, so after role gating nobody could manage users. No promotion step existed anywhere | `HANDOFF.md:65-67,94` | 0b |
| G9 | Entra cannot be bolted on as-is: `users.passwordHash` NOT NULL, no oid column, `token.id` would not be the integer `users.id` (audit inserts become NaN), role is a sign-in snapshot | `src/lib/auth.ts:37-53`; `src/lib/db/schema.ts:20-28` | 1 |
| G10 | next-auth specifics: a DB error inside the `jwt` callback clears the session cookie; `maxAge` is an idle timeout (re-signed on every request), not a session length; the stock Entra provider calls Graph, fetches the photo into the cookie, and often has no `email` | `@auth/core/lib/actions/session.js:33-62`; `providers/microsoft-entra-id.js:118-138` | 1 |
| G11 | The M365 tenant was compromised on 2026-09-07. MFA for this app must be enforced in the tenant (Conditional Access needs Entra ID P1 — check the licence), with "Assignment required = Yes" | Outline incident doc | 1 |
| G12 | Parity inventory has no go-live / post-launch / drop marks, so the rest of P2 cannot be scoped; the questions page is unsent. Vincent's `lsbd_sync_ro` SQL login (spec §11 F1) is a long-lead item | inventory draft | 0 |
| G13 | `permits.dentist_id` → `person.legacy_key` is inferred, not verified. `as_permit` is empty; anesthesia/sedation lives in `permits` + `permit_type` | task-14 report | 2 |
| G14 | No CI and zero tests for auth, actions or pages. Three sync tests need PowerShell, so CI must run on Windows | `package.json`; `tests/sync/alert.test.ts` etc. | 0 |
| G15 | 140 Dependabot alerts on `main`, 7 critical, on the live site | ledger `:190` | 0 |
| G16 | Spec drift: spec says `lsbd.public_licensee`, `/verify`, and roles from Entra groups; code has `public.public_licensee` and `/public/verify` | spec `:42,189` | 1, 5 |

## Optimizations adopted (and things cut)

- **Drop PostgREST from the public path.** Verify and directory query `public.public_licensee` through the server pool. The view becomes owner-rights (`ALTER VIEW … SET (security_invoker = false, security_barrier = true)`), and `anon`/`authenticated` lose every grant on `lsbd` and on the view. This closes G5, removes the anon policies, and means new directory columns need no base-table grants.
- **Two least-privilege DB roles instead of `postgres`:** `lsbd_app` (CMS read/write, SELECT on the public view and the two sync bookkeeping tables, INSERT+SELECT only on log tables) and `lsbd_staff_ro` (SELECT on an explicit allow-list of `lsbd` tables, never `licensee_pii` or `lsbd.users`). Postgres itself then enforces "read-only until cutover".
- **Entra App Roles** in the ID token's `roles` claim: no Graph call, no group mapping.
- **Directory as path segments** (`/directory/[type]/[prefix]/[page]`) so pages can be statically regenerated; `revalidate` does nothing on a `searchParams` page.
- **One settings table** (`public.site_settings`) for the go-live mode flag and, in P3, the payments mode flag. Not `app_settings`: `lsbd.app_settings` already exists.
- **Licensee detail page doubles as the Access fact sheet** via a print stylesheet.
- **Cut:** trigram/extra indexes (19k rows scan in milliseconds; add only when a query measures slow); Drizzle relational API for `lsbd` (use parameterised SQL); event trigger for RLS (use a test); real HTTP 403 (keep the redirect to `/admin/403`); periodic `is_active` timer (check on every request instead).

## Stages

### Stage 0 — Close the holes (≈3 days). Serial; nothing else starts until it exits

1. **Check G1 first:** request `/rest/v1/users` and `/rest/v1/audit_log` with the anon key. If they answer, fix it the same hour (step 3) and tell Lance.
2. **Fix the migration runner** (`scripts/apply-migration.ts`): pinned CA via the shared sync helper, single transaction, stop on first error, take the `lsbd_sync` advisory lock the way `scripts/sync/apply-transforms.ts:47-55` does.
3. **Migration `0005_db_roles_and_lockdown.sql`** (applied with the fixed runner, sync tasks paused):
   - Enable RLS and revoke `anon`/`authenticated` on every `public` CMS table.
   - Create `lsbd_app`, `lsbd_staff_ro` as NOLOGIN; passwords set out of band, never in the file. `statement_timeout` on both.
   - Explicit grants (no default privileges) plus `FOR SELECT … USING (true)` policies for `lsbd_staff_ro` on its allow-list, and for `lsbd_app` on `lsbd_raw._sync_runs` / `_sync_tables` (needed by `/admin/sync`). RLS is on for every `lsbd` table with only `anon` policies today, so a role with SELECT and no policy sees **zero rows and no error**.
   - Alter the view per the first optimization; add `legacy_key` as the stable row key; drop the `anon` policies and grants.
   - PII read function in a non-exposed schema, `SECURITY DEFINER`, `SET search_path = ''`, `REVOKE EXECUTE FROM PUBLIC`, called through the `lsbd_app` pool; it inserts an access-log row.
   - Confirm table/view ownership live before relying on owner-rights.
4. **`scripts/verify-rls.ts` becomes a real check:** anon is denied on `public.users`, `lsbd.license` and the view with the *expected* error; the app role reads ≥ 13,000 rows from the view; `lsbd_staff_ro` cannot UPDATE. Add `tests/it/grants.test.ts` that diffs actual grants and fails if any `lsbd` table lacks RLS.
5. **Role gates.** `src/lib/auth-capabilities.ts` (role → capability: `cms.write`, `users.manage`, `sync.view`, `licensees.read`, `permits.read`, `discipline.read`, `pii.read`) and `requireCapability(cap)` in `src/lib/auth-utils.ts`. Replace all nine `requireSession()` copies; gate the read functions (`getPosts`, `getRecentAuditLog`, …), every `/admin` page, `/api/upload`, and `deleteFileAction` (known folders only). `/api/search` returns published posts only. Sidebar items take a capability instead of `adminOnly`.
6. **Public path:** move `src/lib/public-verify.ts` from the anon client to the server pool; coerce array params; drop the double `decodeURIComponent`; escape `%`, `_`; reject pages past the cap before querying; generic error text; `no-store` on verify search/detail responses.
7. **CI:** `typecheck` script; GitHub Actions on `windows-latest` running `tsc --noEmit`, `eslint`, `npm test`.
8. **Dependabot:** triage the 7 criticals on `main`.
9. **Draft (not send) the email to Erin and Vincent:** the 14 questions, a request to mark each of the 24 functions go-live / post-launch / drop, and the `lsbd_sync_ro` login request. Lance sends it.

New Vercel env values (`POSTGRES_URL` → `lsbd_app`, new `LSBD_RO_URL`) go to **Preview only** here. **User action** if the token cannot write env.

Exit: anon key reads nothing; a `board` user cannot change anything; verify still returns ~13,004 rows; no 500s; CI green.

### Stage 0b — Promote to production (≈½ day, needs Lance present)

Freeze CMS edits → re-copy CMS content Neon → Supabase → promote one user to `admin` → finish/merge the P1 branch → set Production env to the new roles → production deploy → smoke test → only then disconnect the Neon store (re-check `POSTGRES_URL` survives). Until this runs, **do not redeploy `main`**.

### Stage 1 — Entra ID SSO (≈3 days code; tenant steps are Lance's)

**Tenant (Lance, tenant `lsbd.org`):** single-tenant app registration; six App Roles; "Assignment required = Yes"; assign staff; redirect URIs for production, `localhost:3000` and one fixed preview alias; MFA enforced for the app; hand over `AUTH_MICROSOFT_ENTRA_ID_ID`, `_SECRET`, `_ISSUER` (no trailing slash).

**Code:**
- Migration `0006_users_entra.sql`: `password_hash` nullable; add `entra_oid` (unique), `is_active`, `last_login_at`.
- `src/lib/auth.ts`: `microsoft-entra-id` provider with `profile()` overridden and scope `openid profile email` (no Graph, no photo). `signIn` rejects a wrong `tid` or an empty `roles` claim. On sign-in only, the `jwt` callback upserts `public.users` by `entra_oid` (first sign-in links an existing row by case-insensitive `preferred_username`), sets `token.id` to the integer `users.id`, the role from the claim (highest wins), and `signedInAt`. No DB work in `jwt` after that.
- `requireCapability` reads `is_active` on every request, wrapped in React `cache()`, and rejects tokens older than an absolute 10 h from `signedInAt`. Disabling a user takes effect immediately.
- Pure helpers `src/lib/auth-entra.ts` (`pickRole`, `resolveUser(queryFn, claims)`), unit-tested with an injected query function, following `src/lib/sync-status.ts`.
- Credentials provider only when `AUTH_ALLOW_CREDENTIALS=1`, rate-limited. `AUTH_URL` set per environment.
- `/admin/users` becomes read-only apart from `is_active` (roles come from Entra).
- Audit rows for sign-in, sign-out, denied access. Amend spec `:42` (App Roles, not groups).

Exit: staff sign in with Microsoft + MFA; a role change applies at next sign-in (≤ 10 h); a disabled user is locked out on their next request.

### Stage 2 — Staff data foundation (≈1.5 days)

- `src/lib/db/lsbd-ro.ts`: lazy second pool on `LSBD_RO_URL`, reusing `dbPoolConfig` and the pinned CA from `src/lib/db/client-options.ts`. Check the Supavisor pool budget for two roles.
- Verify G13 with a count query (`permits.dentist_id` vs `person.legacy_key`) before any permit screen.
- `src/components/admin/server-table.tsx`: server-paginated, `searchParams`-driven, built on the unused `src/components/ui/pagination.tsx` (the client `data-table.tsx` would ship all 19k rows).
- `public.site_settings` + a "read-only until go-live" banner in `/admin`.
- One file of code → label maps (status, class, type), so Erin's answers are a one-file change.

### Stage 3 — Licensees, read-only (≈4 days)

- `/admin/licensees`: search by name, licence number, type, status, city. Loader `src/lib/staff-licensees.ts`, injected query function, parameterised SQL only.
- `/admin/licensees/[key]`, `key` = `tblDenHyg.Key` (`legacy_key`), the durable identity. Sections: licences, addresses, education, permits, affiliations, firm links. Discipline summary needs `discipline.read`; DOB needs `pii.read` and goes through the logging function.
- Every NULL foreign key renders as "not linked" (the transforms load rows with NULL refs by design).
- Badges for known data oddities: active but past expiry (2,872), NULL status from source `CUR` (21), duplicate type+number groups (17).
- Print stylesheet = fact sheet.

### Stage 4 — Permits and firms, read-only (≈3 days)

- `/admin/permits`: personal vs office split on `office_id > 0` (the Access rule); filter by type and level; fall back to `permits.permit_type_name` when the type link is NULL. Anesthesia/sedation is a filter here.
- `/admin/firms`: PLLC list/detail from `professional_llc`; PA list shows the empty state (0 rows at source).

### Stage 5 — Public `/directory` (≈2 days; may run alongside Stages 3–4)

- `/directory/[type]/[prefix]/[page]`, statically regenerated every 15 min; detail links reuse the verify detail page. Fields: name, type, status. Office city/parish behind `DIRECTORY_SHOW_CITY`, off.
- Worst-case staleness is about 30 min (15 min sync + 15 min regeneration). Verify stays uncached and is the page to use for a live status check; the directory says so.
- `/verify` → `/public/verify` alias; correct spec `:189`.
- Rate limiting moves to a Vercel Firewall rule for `/public/verify*`. **User action** if the token cannot write firewall config.

### Stage 6 — Housekeeping (≈1 day)

Delete the legacy one-shot `scripts/etl-*.ts`, `seed*.ts`, `verify-load*.ts`, `snapshot-lsbd.ts` (ruling R43); remaining Dependabot alerts; update spec, HANDOFF.md, CLAUDE.md, Outline. Then write the plan for the Erin-dependent modules.

## Order and parallelism

| When | What |
|---|---|
| Oct 2 | P1 exit commit; cut `feat/p2-admin-core` |
| Oct 2–6 | Stage 0 (serial) |
| when Lance is free | Stage 0b |
| Oct 7–9 | Stage 1 code (testable with mocked claims until the tenant steps are done) |
| Oct 7–19 | Stages 2 → 3 → 4; Stage 5 alongside |
| Oct 20 | Stage 6 |

Migrations are numbered up front (0005, 0006, 0007 for `site_settings`) and applied one at
a time; `src/lib/db/schema.ts` and the Drizzle journal are shared, so schema changes are
never done by two implementers at once. Page and loader work in Stages 3, 4 and 5 touches
separate files and can run in parallel.

Execution: `superpowers:writing-plans` turns each stage into TDD tasks, then
`subagent-driven-development` with the same ledger and rulings discipline as P1.

## Waiting on Lance / Erin

- Send the email (Stage 0.9). Without priorities the second half of P2 cannot be planned.
- Entra: app registration, App Roles, assignment required, MFA policy (check for Entra ID P1), three env values.
- Vercel env for the new DB roles (Preview at Stage 0, Production at Stage 0b); be present for Stage 0b.
- Still open from P1: PITR add-on, healthcheck URL.

## Verification

- After every stage: `npm test`, `npx tsc --noEmit`, `npm run lint`, `next build`; CI runs the same.
- **Stage 0:** anon-key requests to `/rest/v1/users`, `/rest/v1/audit_log`, `lsbd.license` and the view are all denied; `scripts/verify-rls.ts` and `tests/it/grants.test.ts` pass; verify search for SMITH still returns results and the view count is ≈13,004; `last_name=%25%25&page=999`, a repeated `q`, and `/public/verify/%25E0` return a validation message, never 500; signed in as each of the six roles on the preview, only `admin`/`staff` can write CMS content; `/api/search` returns no drafts; a quick sync and a reconcile still pass after the migration.
- **Stage 0b:** production pages render CMS content from Supabase; `/admin/users` reachable by the promoted admin.
- **Stage 1:** Entra sign-in on the preview alias; an `audit_log` row carries an integer `user_id`; changing an App Role applies at next sign-in; setting `is_active = false` blocks the next request; credentials login is refused in production.
- **Stage 2:** `UPDATE lsbd.person` through the read-only pool is refused by Postgres; `SELECT` on `lsbd.licensee_pii` is refused.
- **Stages 3–4:** list counts equal `SELECT count(*)`; five licensees and five permits compared field by field against Access with Erin.
- **Stage 5:** directory total equals the view count; city/parish absent from the HTML.
- Pause the `LSBD Sync*` tasks while `npm run test:it` or a migration runs (runbook §3).
