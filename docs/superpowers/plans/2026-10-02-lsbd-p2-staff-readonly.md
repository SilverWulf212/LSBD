# LSBD P2 Staff Read-Only Screens (Stages 2–4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Board staff read-only `/admin` screens over the synced `lsbd.*` data: a licensee list and detail page (which prints as the fact sheet), a permits list, and a firms list and detail, with Postgres itself refusing any write.

**Architecture:** Every staff query runs through one helper, `withStaffRo`, which takes a client from the existing app pool, opens a transaction, runs `SET LOCAL ROLE lsbd_staff_ro`, and hands the caller a query function that only works inside that transaction. Loaders are pure modules of parameterised SQL that take the query function as an argument (unit-tested with a fake); one server-only module (`staff-data.ts`) checks the capability and then binds the loaders to `withStaffRo`; pages are server components driven by `searchParams`.

**Tech Stack:** Next.js 16.3 App Router (`src/app`), React 19 server components, node-postgres through Drizzle's `db.$client` pool, next-auth v5 capabilities (`requireCapability`), Tailwind 4 (`print:` variants), shadcn components in `src/components/ui/`, vitest 4 (node environment).

**Spec:** `docs/superpowers/specs/2026-10-01-lsbd-p2-staged-plan.md`, Stages 2, 3 and 4 only. Stage 1 (Entra SSO), Stage 5 (public directory) and every write screen are out of this plan. Where the "Decisions that supersede the spec" below differ from the spec, the decisions win.

## Global Constraints

**Scope and safety**

- Work only on branch `feat/p2-staff-readonly`. Do not switch branches, push, deploy, or touch `main`.
- Executors must not connect to any database, must not run anything under `scripts/` that opens a connection, and must not apply SQL. Do not read `.env.local` or any secrets file. Do not run `npm run build` (it can read the database through `.env.local`); the controller runs it at the end.
- **No SQL files, no `src/lib/db/schema.ts` change, no migration, no new table** anywhere in this plan.
- Never write `rejectUnauthorized: false`. No new dependencies.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

**Decisions that supersede the spec**

- D1. **No second pool and no `LSBD_RO_URL`.** Read-only is enforced by `SET LOCAL ROLE lsbd_staff_ro` inside a transaction on the existing pool (`db.$client` from `src/lib/db/index.ts`, a `pg.Pool` built by `dbPoolConfig` with `max: 1`). Verified on the live database through the 6543 transaction pooler on 2026-10-02: `current_user` becomes `lsbd_staff_ro`; `SELECT count(*) FROM lsbd.license` returns 19285; `SELECT … FROM lsbd.licensee_pii` and `UPDATE lsbd.person …` fail with SQLSTATE 42501; after the transaction the connection is `postgres` again.
- D2. `withStaffRo` (Task 1) is the **only** way staff screens touch `lsbd.*`. No staff page or loader may use `db.select`, `db.execute`, `db.$client` or the Drizzle relational API for `lsbd`.
- D3. **The pool has one connection.** Inside a `withStaffRo` callback never call `auth()`, `requireCapability()`, `db.*`, or a nested `withStaffRo`: each would wait for the connection the callback is holding, forever. Check the capability first, then open the transaction.
- D4. Screens may read only the tables `lsbd_staff_ro` is granted (`drizzle/0006_db_roles.sql`, mirrored in `scripts/lib/staff-ro-tables.ts`): `person`, `license`, `person_address`, `person_education`, `person_meta`, `individual_status`, `professional`, `individual_affiliation`, `office`, `office_affiliation`, `permits`, `permit_type`, `sed_level`, `professional_llc`, `professional_association`, `disciplinary`, `education`, `education_type`, `countries`, `states`, `parishes`, `tbl_counties`, `cities`, `zipcodes`, `election_districts`, `address_type_lookup`, `tbl_types`, `tbl_status`, `tbl_class`, `tbl_inactive_status`, `tbl_specialties`, `professional_type`, `practice_type`, plus `individual` by column (never `ssn`, `dob`, `sex`, `race`).
- D5. Never write `SELECT *` or `alias.*`. No query on `licensee_pii`, `person_practice_stats`, or any transaction, renewal, complaint, login or `lsbd_raw` relation. **DOB is not displayed in this plan** (it needs a logging function that does not exist yet; a later plan adds it).
- D6. All SQL is parameterised text passed to the injected query function. User input reaches SQL only as a bound parameter. `LIKE`/`ILIKE` input goes through `escapeLike` from `src/lib/sql-like.ts`.
- D7. Capabilities are the existing ones in `src/lib/auth-capabilities.ts`: licensee pages `licensees.read`; permits **and firms** pages `permits.read`; the discipline section `discipline.read`; home and permanent addresses, e-mail, phones and fax `pii.read`. Gate with `requireCapability` from `src/lib/auth-utils.ts` and `can` from `src/lib/auth-capabilities.ts`. A section the role may not see is not queried at all.
- D8. Free-text columns flagged by ruling R15 are handled conservatively: `disciplinary.notes` only with `discipline.read`; `individual.notes`, `person_meta.inactive_reason`, `professional_llc.notes` and `comment1`–`comment3` are **not selected** in this plan.
- D9. The read-only banner is driven by the environment variable `LSBD_STAFF_MODE` (default `readonly`), read in one module (Task 2). There is no `public.site_settings` table in this plan.
- D10. Identity: the licensee URL key is `legacy_key` (= `tblDenHyg.Key`). One `lsbd.person` row and one `lsbd.license` row exist per key; `lsbd.license.legacy_key = lsbd.person.legacy_key`. A licence number is not unique and is never used as a key.
- D11. Every NULL or dangling reference renders the text `not linked` (component `NotLinked`, Task 4). A section whose lookup key is NULL says it cannot be looked up; it never says "none".
- D12. Dates are shown with `formatCentralDate` / `formatCentralDateTime` from `src/lib/central-time.ts` only (never `toLocaleDateString` directly).
- D13. Page size is **25**; the page number is clamped to **1..10000**; a requested page past the last row falls back to page 1 (same rule as the public verify search).

**Working rules**

- Unit tests live in `tests/app/`, run with `npm test` (vitest, node environment). They must not need a database or network. They import source with relative paths (`../../src/lib/...`).
- vitest has **no `@/` alias**: a module that a test imports must use relative imports only, all the way down. Type-only imports are erased, so `import type { RoQueryFn } from "./db/lsbd-ro"` is safe. React components and `staff-data.ts` use `@/` imports and are checked by source-text tests, as `tests/app/admin-gates.test.ts` already does.
- On this host (Node 20.18) `npm test` needs `NODE_OPTIONS=--experimental-require-module`. In PowerShell 5.1: `$env:NODE_OPTIONS='--experimental-require-module'; npm test`. PowerShell 5.1 has no `&&`; Git Bash is also available.
- Before each commit: `npm test`, `npm run typecheck`, and `npx eslint <changed files>` are clean (existing warnings in untouched files are not yours).
- Next.js 16: page `params` and `searchParams` are Promises. Server components by default. Match the style of `src/app/admin/sync/page.tsx` and `src/app/admin/users/` (heading block, `Card`, `Table`, `Badge`, `role="alert"` error box, `export const dynamic = "force-dynamic"`).
- Match the surrounding code's style and comment density.

## Review Focus

1. **Search text containing `%`, `_`, `\` or `&`** (`O'BRIEN & CO`, `50%`, `a_b`): the characters are matched literally and survive in pagination links. Tests in Task 4 (`pageHref`), Task 5 (licensees) and Task 8 (firms).
2. **A person row with no licence row**: the list shows the person with "No licence record" and the detail page renders; neither drops the person nor throws. Tests in Task 5 and Task 6.
3. **Pagination at the edges of 19,285 rows** (`page=0`, `-1`, `abc`, `1e9`, `772`, `773`): clamped, stable order across pages (unique tie-break), fallback to page 1, never a 500. Tests in Task 4 (`parsePage`, `runPaged`) and Task 5 (offset 19275, `ORDER BY … legacy_key`).
4. **NULL or dangling foreign keys** (permit with NULL `dentist_id`, with a `dentist_id` matching no person, with NULL type link; person with NULL `individual_id`; office affiliation with NULL `office_id`): the row is shown with `not linked`, and discipline for an unlinked person says "cannot be looked up", not "none". Tests in Task 6, Task 7 and Task 9.
5. **A role without the capability on a deep link**: `staff` (no `discipline.read`) opening `/admin/licensees/[key]` gets no discipline rows and no discipline query is sent; `discipline` and `board` (no `pii.read`) get no home address, e-mail or phone; a signed-out visitor is redirected before any query. Tests in Task 6, Task 9 and Task 10.

## Open Questions and Unverified Joins

These could not be settled from the repository. Each has a default so the tasks are unambiguous; each default fails safe (`not linked`, raw code, or hidden). The controller should run the U1–U4 counts (through `SET LOCAL ROLE lsbd_staff_ro`, read-only) before the task that uses the join, and record the result in the ledger.

| # | Item | Evidence | Default in this plan |
|---|------|----------|----------------------|
| U1 | `permits.office_id` → `professional_llc.id` (the firm of an office permit) | Unverified. Access joins `Permits` to `tblPLLCs` and uses `Inspections.OFFICE_ID = frmFirm!Key`; the transform loads `office_id` verbatim. Other candidates: `office.id`, `professional_llc.office_id` | Task 7 joins on `professional_llc.id`, in one exported constant `PERMIT_FIRM_JOIN`; a miss shows `Office #<id>` + `not linked` |
| U2 | `office_affiliation.office_id` → `office.id` | The transform resolves it this way, but sets it NULL for about 1,926 of 4,088 rows (ruling R28: source ids above the highest `Office` row). Access joins `OfficeAffiliation` to `tblPLLCs`, so the true target may be the PLLC key, which `lsbd_staff_ro` cannot see for those rows | Task 9 joins `office.id`; NULL shows `not linked` |
| U3 | `license.pllc_number` → `professional_llc.license_id`; `license.pa_number` → `professional_association.license_id` | Unverified (column comments only) | Task 8 matches `btrim(number)`; the raw number is always shown; no match shows `not linked` |
| U4 | `education.den_hyg_id` → `person.legacy_key` | Unverified (column name `DenHygID`; loaded verbatim) | Task 6 uses it; no match shows only the licence-record school and a "no linked rows" line |
| Q1 | Labels for status and class codes | Only `ACT` = Active, `PRB` = Probation and the four type codes are confirmed in the repo. `lsbd.tbl_status.status` and `lsbd.tbl_class.class_desc` hold the Board's own labels | Task 3 ships the confirmed labels; every other code shows as the code. Filling the map is a one-file change |
| Q2 | "NULL status from source `CUR`" | The source code is only in `lsbd_raw`, which `lsbd_staff_ro` cannot read. 21 EDDA rows had `CUR` on 2026-09-30; whether other unmapped codes exist is unknown | Badge rule is `status IS NULL`, labelled "No status (unmapped source code, e.g. CUR)" |
| Q3 | "Active but past expiry": `ACT` only, or `ACT` and `PRB`? | The 2,872 figure (task-13 report) counted `ACT`/`PRB` rows | `ACT` or `PRB`, and the Central calendar day of `date_until` is before today's |
| Q4 | Who may see home address, phones, e-mail, free-text notes (ruling R15) | Deferred to Erin's answer on roles | D7 and D8 above |
| Q5 | Meaning of `person_education.degree` (smallint) and whether `permits.permit_level` maps to `sed_level.s_level` | Not derivable | Shown as raw values; `sed_level` is not joined |
| Q6 | Capability for firms | No `firms.read` exists | `permits.read` (D7) |
| Q7 | If the app later connects as `lsbd_app` (0006 on Preview), `SET LOCAL ROLE lsbd_staff_ro` needs `GRANT lsbd_staff_ro TO lsbd_app`, and the role's `statement_timeout` (a login-time setting) does not apply under `SET ROLE` | `0006` grants membership to `postgres` only | Out of scope (no SQL here); the controller raises it with the user |

Counts for the controller (not for executors): U1 `SELECT count(*) FILTER (WHERE pm.office_id > 0) AS office_permits, count(f.id) AS llc_id, count(o.id) AS office_id, count(f2.id) AS llc_office_id FROM lsbd.permits pm LEFT JOIN lsbd.professional_llc f ON pm.office_id > 0 AND f.id = pm.office_id LEFT JOIN lsbd.office o ON pm.office_id > 0 AND o.id = pm.office_id LEFT JOIN lsbd.professional_llc f2 ON pm.office_id > 0 AND f2.office_id = pm.office_id`; U3 `SELECT count(*) FILTER (WHERE l.pllc_number IS NOT NULL) AS with_number, count(DISTINCT l.id) FILTER (WHERE f.id IS NOT NULL) AS matched FROM lsbd.license l LEFT JOIN lsbd.professional_llc f ON f.license_id = btrim(l.pllc_number)`; U4 `SELECT count(*) AS n, count(p.id) AS matched FROM lsbd.education e LEFT JOIN lsbd.person p ON p.legacy_key = e.den_hyg_id`. If a match rate is under 95%, stop and re-plan that join before its task runs.

### Controller rulings from the live counts (2026-10-02, run as `lsbd_staff_ro`). These override the table above and any task text that conflicts.

- **CR1 (U1).** `permits.office_id` → `professional_llc.id` matches 504 of 552 office permits (91%); every other candidate is far lower (`office.id` 286, `professional_llc.office_id` 243). Keep the Task 7 join on `professional_llc.id`; the 48 misses show `Office #<id>` + `not linked`. The 95% stop rule is waived for U1.
- **CR2 (U2).** Every non-NULL `office_affiliation.office_id` (2,160 of 4,083) matches `office.id`. Task 9 as written.
- **CR3 (U3). There is no licence → firm link by number.** `license.pllc_number` and `pa_number` are `'0'` on 16,792 rows and NULL on the rest, and 3,291 `professional_llc` rows have `license_id = '0'`, so a `btrim` match would attach thousands of firms to every licensee. **Do not write any query that matches `license.pllc_number` or `pa_number` to a firm.** Task 8: drop the "firm links" loader for a licensee; Task 9: the licensee page has no firm-links section. A firm's detail page shows the firm and its office permits only. `pllc_number` / `pa_number` are not displayed.
- **CR4 (U4). `lsbd.education` is not joined.** `education.den_hyg_id` is NULL on all 16,985 rows, and `education.individual_id` (integer, up to 31,346) does not match `individual.indv_id` (1–8,500) or `legacy_id` beyond chance. Task 6 shows the licence-record school from `person_education` only, with the line "Detailed education history is not linked to licensees yet." No query on `lsbd.education` or `education_type` in this plan.
- **CR5 (Q1). Labels are known.** Status (`tbl_status`): ACT Active, SUS Suspended, REV Revoked, REP Reprimanded, ARC Archived, PRB Probation, DEC Deceased, EXP Expired, OTH Other, TMP Temporary, INA Inactive, RET Retired, VOL Voluntary. Class (`tbl_class`): L Licensee, A Applicant, I Intern, P Provisional, T Instructor, O Other, C Credentialing, V Volunteer, NL Non-Licensee. Task 3 ships these maps; an unknown code still shows as the code.
- **CR6.** `person.individual_id` is set on 8,486 of 19,285 person rows, so sections that depend on it (other licences of the same individual, discipline) say "cannot be looked up" for the rest, per D11.

Verified joins used below, for reference: `permits.dentist_id = person.legacy_key` (G13: 7,532 of 7,550 non-null match, 14 NULL, 18 dangling); `individual_affiliation.dentist_legacy_id` / `individual_legacy_id` and `office_affiliation.dentist_id` are `tblDenHyg.Key` values (task-14 report: 15,349 / 15,367 / 4,076 match); `person.individual_id` and `disciplinary.individual_id` are both resolved to `lsbd.individual.individual_id` by the transforms (598 of 644 discipline rows linked); `permits.permit_type_id = permit_type.id`, `education.education_type_id = education_type.id`, `education.school_state_id = states.id` and `person_*.person_id = person.id` are set by the transforms.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `src/lib/db/lsbd-ro.ts` | `withStaffRo`: the read-only transaction | 1 |
| `src/lib/staff-mode.ts`, `src/components/admin/readonly-banner.tsx` | Mode flag and banner | 2 |
| `src/lib/staff-labels.ts` | The one file of code → label maps, name formatting | 3 |
| `src/lib/staff-oddities.ts` | Data-oddity rules | 3 |
| `src/lib/staff-query.ts` | Page parsing, paged query runner, link builder, row value helpers | 4 |
| `src/components/admin/server-table.tsx`, `not-linked.tsx` | Server-paginated table, `not linked` marker | 4 |
| `src/lib/staff-licensees.ts` | Licensee search | 5 |
| `src/lib/staff-licensee-detail.ts` | Licensee detail sections | 6, 9 |
| `src/lib/staff-permits.ts` | Permit list and per-holder / per-firm permits | 7 |
| `src/lib/staff-firms.ts` | Firm list, detail, firm links | 8 |
| `src/lib/staff-data.ts` | Capability check + `withStaffRo` binding (the only non-pure staff module) | 10, 11 |
| `src/app/admin/licensees/…`, `permits/…`, `firms/…` | Pages | 10, 11 |

---

### Task 1: `withStaffRo`, the read-only transaction

**Files:**
- Create: `src/lib/db/lsbd-ro.ts`
- Test: `tests/app/staff-ro.test.ts`

**Interfaces:**
- Consumes: `db` from `src/lib/db/index.ts` (import it as `./index`; `db.$client` is the `pg.Pool`, as `src/lib/public-verify.ts` already uses it). Importing it does not connect (the proxy is lazy).
- Produces:

```ts
export const STAFF_RO_ROLE = "lsbd_staff_ro";
export type RoQueryFn = (text: string, params?: readonly unknown[]) => Promise<readonly Record<string, unknown>[]>;
export interface RoClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean | Error): void;
}
/** Testable core: `connect` supplies the client. */
export function runStaffRo<T>(connect: () => Promise<RoClient>, fn: (q: RoQueryFn) => Promise<T>): Promise<T>;
/** Production binding: runStaffRo(() => db.$client.connect(), fn). */
export function withStaffRo<T>(fn: (q: RoQueryFn) => Promise<T>): Promise<T>;
```

- [ ] **Step 1: Write the failing tests** in `tests/app/staff-ro.test.ts`. Use a fake client that records `{ text, params }` per `query` call and each `release` argument, and can be told to reject on a given statement.

```ts
it("runs BEGIN, SET LOCAL ROLE, the queries, COMMIT, then releases", async () => {
  const r = await runStaffRo(connect, async (q) => { await q("SELECT $1::int AS n", [5]); return "done"; });
  expect(r).toBe("done");
  expect(texts).toEqual(["BEGIN", "SET LOCAL ROLE lsbd_staff_ro", "SELECT $1::int AS n", "COMMIT"]);
  expect(calls[2].params).toEqual([5]);
  expect(releases).toEqual([undefined]);
});
it("passes an empty array when no params are given", …);          // calls[2].params toEqual([])
it("rolls back and rethrows when the callback throws", …);        // texts: BEGIN, SET LOCAL ROLE…, ROLLBACK; rejects with the same Error; releases [undefined]
it("never runs the callback when SET LOCAL ROLE is refused", …);  // fn not called; texts end with ROLLBACK; rejects with the 42501 error
it("destroys the client when ROLLBACK fails, and rethrows the original error", …); // releases toEqual([true])
it("destroys the client when COMMIT fails", …);                   // rejects with the COMMIT error; releases toEqual([true])
it("rejects without releasing when connect fails", …);            // releases toEqual([])
it("serialises concurrent calls on the one client", …);           // Promise.all([q("A"), q("B")]): the fake sees B start only after A resolved; order A, B
it("refuses a query after the transaction has ended", async () => {
  let leaked!: RoQueryFn;
  await runStaffRo(connect, async (q) => { leaked = q; });
  await expect(leaked("SELECT 1")).rejects.toThrow("withStaffRo: query after the transaction ended");
  expect(texts).not.toContain("SELECT 1");
});
it("exports the role name used in SET LOCAL ROLE", …);            // STAFF_RO_ROLE === "lsbd_staff_ro"
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/staff-ro.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement `src/lib/db/lsbd-ro.ts`.** The statement text is exactly `BEGIN`, `SET LOCAL ROLE lsbd_staff_ro`, `COMMIT`, `ROLLBACK` (the role name is a constant, never input). `q` chains each call onto the previous one (pg deprecates overlapping `client.query` calls) and copies `params` into a new array. Release with no argument on a clean COMMIT or ROLLBACK; `release(true)` when COMMIT or ROLLBACK itself fails, so a connection that may still be inside the transaction is not reused. If `PoolClient` is not directly assignable to `RoClient`, adapt it in `withStaffRo` with a two-method wrapper. Put a header comment stating D2 and D3.
- [ ] **Step 4: Run to verify pass.** Same command → PASS. Then `npm test`, `npm run typecheck`, `npx eslint src/lib/db/lsbd-ro.ts tests/app/staff-ro.test.ts`.
- [ ] **Step 5: Commit.**

```bash
git add src/lib/db/lsbd-ro.ts tests/app/staff-ro.test.ts
git commit -m "feat(staff): read-only lsbd access through SET LOCAL ROLE lsbd_staff_ro" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Staff mode flag, read-only banner, print-ready admin layout

**Files:**
- Create: `src/lib/staff-mode.ts`, `src/components/admin/readonly-banner.tsx`
- Modify: `src/app/admin/layout.tsx` (signed-in branch only), `.env.example` (add `LSBD_STAFF_MODE=readonly` with a one-line comment)
- Test: `tests/app/staff-mode.test.ts`

**Interfaces:**
- Produces:

```ts
// src/lib/staff-mode.ts (no imports)
export type StaffMode = "readonly" | "live";
export const READONLY_BANNER_TITLE = "Read-only until go-live";
export const READONLY_BANNER_TEXT =
  "Licensee, permit and firm records here are a copy of the Access database, refreshed about every 15 minutes during business hours. They cannot be changed here until go-live: keep making changes in Access.";
export function parseStaffMode(v: string | null | undefined): StaffMode;
export function getStaffMode(env?: Record<string, string | undefined>): StaffMode; // reads LSBD_STAFF_MODE, default process.env
// src/components/admin/readonly-banner.tsx (server component)
export function ReadonlyBanner(): React.JSX.Element | null;
```

- [ ] **Step 1: Write the failing tests.**

```ts
it("is readonly unless the value is exactly live", () => {
  for (const v of [undefined, null, "", "readonly", "LIVE!", "true", "1", "off"]) expect(parseStaffMode(v)).toBe("readonly");
  expect(parseStaffMode("live")).toBe("live");
  expect(parseStaffMode(" Live ")).toBe("live");
});
it("reads LSBD_STAFF_MODE", () => {
  expect(getStaffMode({})).toBe("readonly");
  expect(getStaffMode({ LSBD_STAFF_MODE: "live" })).toBe("live");
});
// source-text checks, reading the files as tests/app/admin-gates.test.ts does
it("the admin layout renders the banner and can be printed", () => {
  // layout.tsx contains "<ReadonlyBanner", "print:hidden" at least twice (sidebar aside, header wrapper),
  // "print:overflow-visible" and "print:h-auto"
});
it("the banner hides in print and shows nothing when live", () => {
  // readonly-banner.tsx contains "getStaffMode(", "print:hidden", 'role="status"', READONLY_BANNER_TITLE and READONLY_BANNER_TEXT; no "use client"
});
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/staff-mode.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `ReadonlyBanner` returns `null` when the mode is `live`; otherwise an amber box (same shape as the alert boxes in `src/app/admin/sync/page.tsx`) with the two exported strings. In `layout.tsx` render it directly above `<main>`. Add print variants so a long page prints in full: root div `print:block print:h-auto print:overflow-visible print:bg-white`; the `<aside>` `print:hidden`; wrap `<AdminHeader>` in `<div className="print:hidden">`; the inner column `print:block print:overflow-visible`; `<main>` `print:overflow-visible print:p-0`. The signed-out branch is unchanged.
- [ ] **Step 4: Run to verify pass**, then `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 5: Commit** — `feat(admin): read-only banner from LSBD_STAFF_MODE and a printable admin layout`.

---

### Task 3: Code → label maps and data-oddity rules

**Files:**
- Create: `src/lib/staff-labels.ts`, `src/lib/staff-oddities.ts`
- Test: `tests/app/staff-labels.test.ts`, `tests/app/staff-oddities.test.ts`

**Interfaces:**
- Consumes: `isExpired(dateUntil: string | null, now?: Date): boolean` from `./public-verify-helpers` (Central calendar day of `dateUntil` strictly before today's Central day).
- Produces:

```ts
// src/lib/staff-labels.ts (no imports)
export const LICENSE_TYPES = ["D", "H", "E", "O"] as const;
export const LICENSE_STATUSES = ["ACT", "SUS", "REV", "REP", "ARC", "PRB", "DEC", "EXP", "OTH", "TMP", "INA", "RET", "VOL"] as const;
export const LICENSE_CLASSES = ["L", "A", "I", "P", "T", "O", "C", "V", "NL"] as const;
export type StaffLicenseType = (typeof LICENSE_TYPES)[number];
export type StaffLicenseStatus = (typeof LICENSE_STATUSES)[number];
export type StaffLicenseClass = (typeof LICENSE_CLASSES)[number];
export const TYPE_LABELS: Record<StaffLicenseType, string> = { D: "Dentist", H: "Hygienist", E: "EDDA", O: "Office" };
export const STATUS_LABELS: Partial<Record<StaffLicenseStatus, string>> = { ACT: "Active", PRB: "Probation" }; // Q1
export const CLASS_LABELS: Partial<Record<StaffLicenseClass, string>> = {};                                       // Q1
export const ADDRESS_TYPE_LABELS = { home: "Home", office: "Office", permanent: "Permanent" } as const;
export const NO_STATUS_LABEL = "No status";
export const NOT_LINKED_TEXT = "not linked";
export function typeLabel(code: string | null): string;   // label, else the code, else "—"
export function statusLabel(code: string | null): string; // label, else the code, else NO_STATUS_LABEL
export function classLabel(code: string | null): string;  // label, else the code, else "—"
export function formatPersonName(p: { lastName: string | null; firstName: string | null; middleName?: string | null; suffix?: string | null }): string;

// src/lib/staff-oddities.ts
export type LicenceOddity = "expired-active" | "no-status" | "duplicate-number";
export const ODDITY_LABELS: Record<LicenceOddity, string> = {
  "expired-active": "Active, past expiry",
  "no-status": "No status (unmapped source code, e.g. CUR)",
  "duplicate-number": "Duplicate type + number",
};
export function licenceOddities(
  l: { status: string | null; dateUntil: string | null; type: string | null; duplicateCount: number },
  now: Date
): LicenceOddity[];
```

Rules (Q2, Q3): `expired-active` when `status` is `ACT` or `PRB` and `isExpired(dateUntil, now)`; `no-status` when `status === null`; `duplicate-number` when `type !== null && duplicateCount > 1`, where `duplicateCount` is the number of `lsbd.license` rows with the same `type` and `license_id`, this row included (loaders supply it). Output order is the order of the type union.

- [ ] **Step 1: Write the failing tests.**

```ts
// staff-labels.test.ts
import { licenseTypeEnum, licenseStatusEnum, licenseClassEnum } from "../../src/lib/db/lsbd/core";
it("lists exactly the database enum values", () => {
  expect([...LICENSE_TYPES]).toEqual(licenseTypeEnum.enumValues);
  expect([...LICENSE_STATUSES]).toEqual(licenseStatusEnum.enumValues);
  expect([...LICENSE_CLASSES]).toEqual(licenseClassEnum.enumValues);
});
it("falls back to the code, then to a placeholder", () => {
  expect(statusLabel("ACT")).toBe("Active");
  expect(statusLabel("SUS")).toBe("SUS");
  expect(statusLabel(null)).toBe("No status");
  expect(typeLabel("E")).toBe("EDDA");
  expect(typeLabel(null)).toBe("—");
  expect(classLabel("NL")).toBe("NL");
});
it("formats names last-first", () => {
  expect(formatPersonName({ lastName: "SMITH", firstName: "John", middleName: "A", suffix: "Jr" })).toBe("SMITH, John A, Jr");
  expect(formatPersonName({ lastName: "SMITH", firstName: null })).toBe("SMITH");
  expect(formatPersonName({ lastName: null, firstName: "John" })).toBe("John");
  expect(formatPersonName({ lastName: null, firstName: null })).toBe("(no name on record)");
});

// staff-oddities.test.ts — now = Fri 2026-10-02 10:00 CDT
const NOW = new Date("2026-10-02T15:00:00Z");
const base = { status: "ACT", dateUntil: "2027-01-01T05:59:59Z", type: "D", duplicateCount: 1 };
it("has no oddities for an ordinary licence", () => expect(licenceOddities(base, NOW)).toEqual([]));
it("flags ACT and PRB past expiry by Central calendar day", () => {
  expect(licenceOddities({ ...base, dateUntil: "2026-10-02T04:59:59Z" }, NOW)).toEqual(["expired-active"]); // Oct 1 23:59 CDT
  expect(licenceOddities({ ...base, dateUntil: "2026-10-02T05:00:00Z" }, NOW)).toEqual([]);                 // expires today
  expect(licenceOddities({ ...base, status: "PRB", dateUntil: "2020-12-31T06:00:00Z" }, NOW)).toEqual(["expired-active"]);
  expect(licenceOddities({ ...base, status: "SUS", dateUntil: "2020-12-31T06:00:00Z" }, NOW)).toEqual([]);
  expect(licenceOddities({ ...base, dateUntil: "3000-10-10T05:00:00Z" }, NOW)).toEqual([]);                 // EDDA "no expiry"
  expect(licenceOddities({ ...base, dateUntil: null }, NOW)).toEqual([]);
});
it("flags a NULL status", () => expect(licenceOddities({ ...base, status: null }, NOW)).toEqual(["no-status"]));
it("flags duplicates only when the type is known", () => {
  expect(licenceOddities({ ...base, duplicateCount: 2 }, NOW)).toEqual(["duplicate-number"]);
  expect(licenceOddities({ ...base, type: null, duplicateCount: 2 }, NOW)).toEqual([]);
});
it("returns several oddities in a fixed order", () =>
  expect(licenceOddities({ status: null, dateUntil: null, type: "E", duplicateCount: 3 }, NOW)).toEqual(["no-status", "duplicate-number"]));
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/staff-labels.test.ts tests/app/staff-oddities.test.ts` → FAIL.
- [ ] **Step 3: Implement both modules** from the signatures and rules above. `staff-labels.ts` carries a header comment: "The one file to change when the Board confirms what each code means."
- [ ] **Step 4: Run to verify pass**, then `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 5: Commit** — `feat(staff): code label maps and data-oddity rules`.

---

### Task 4: Paging helpers, `ServerTable`, `NotLinked`

**Files:**
- Create: `src/lib/staff-query.ts`, `src/components/admin/server-table.tsx`, `src/components/admin/not-linked.tsx`
- Test: `tests/app/staff-query.test.ts`

**Interfaces:**
- Consumes: `RoQueryFn` (Task 1, `import type { RoQueryFn } from "./db/lsbd-ro"`); `firstParam` from `./public-verify-helpers`; `NOT_LINKED_TEXT` (Task 3); `Table…` from `@/components/ui/table`; `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis` from `@/components/ui/pagination`.
- Produces:

```ts
// src/lib/staff-query.ts
export const STAFF_PAGE_SIZE = 25;
export const STAFF_MAX_PAGE = 10000;
export type RawSearchParams = Record<string, string | string[] | undefined>;
export type Paged<T> = { rows: T[]; total: number; page: number; pageSize: number };
export function parsePage(v: string | string[] | undefined): number;            // integer 1..STAFF_MAX_PAGE, anything else 1
export function cleanText(v: string | string[] | undefined, max?: number): string; // first value, trimmed; "" if it has a control character or is longer than max (default 100)
export function lastPage(total: number, pageSize?: number): number;             // at least 1
export function pageWindow(page: number, last: number): (number | "gap")[];     // 1, last, and page-1..page+1; "gap" between non-neighbours
export function pageHref(basePath: string, params: Record<string, string | undefined>, page: number): string;
export function rangeText(page: number, pageSize: number, total: number, count: number): string; // "Showing 51–75 of 19,285"
/** `sql` has no LIMIT and selects `count(*) OVER() AS total`. Appends "LIMIT 25 OFFSET $n" with the offset bound as the next parameter. */
export function runPaged<T>(q: RoQueryFn, sql: string, params: readonly unknown[], page: number, map: (r: Record<string, unknown>) => T): Promise<Paged<T>>;
export function rowStr(v: unknown): string | null;
export function rowIso(v: unknown): string | null;   // Date -> toISOString()
export function rowNum(v: unknown): number | null;   // bigint strings -> number
export function rowBool(v: unknown): boolean | null;

// src/components/admin/server-table.tsx (server component, no "use client")
export type ServerTableColumn<T> = { header: string; cell: (row: T) => React.ReactNode; className?: string };
export function ServerTable<T>(props: {
  columns: ServerTableColumn<T>[]; rows: T[]; rowKey: (row: T) => string | number;
  total: number; page: number; pageSize: number;
  basePath: string; params: Record<string, string | undefined>; emptyText: string;
}): React.JSX.Element;

// src/components/admin/not-linked.tsx
export function NotLinked(props: { detail?: string }): React.JSX.Element; // muted italic NOT_LINKED_TEXT, then detail if given
```

- [ ] **Step 1: Write the failing tests** (fake query function as in `tests/app/public-verify-query.test.ts`).

```ts
it("clamps the page number", () => {
  for (const v of [undefined, "", "0", "-1", "abc", "2.5", "1e9", "10001", ["x", "3"]]) expect(parsePage(v)).toBe(1);
  expect(parsePage("772")).toBe(772);
  expect(parsePage(["3", "9"])).toBe(3);
  expect(parsePage("10000")).toBe(10000);
});
it("cleans text input", () => {
  expect(cleanText("  smith ")).toBe("smith");
  expect(cleanText(["a", "b"])).toBe("a");
  expect(cleanText("a\u0000b")).toBe("");
  expect(cleanText("a".repeat(101))).toBe("");
  expect(cleanText(undefined)).toBe("");
});
it("builds page links that keep the filters", () => {
  expect(pageHref("/admin/licensees", { last: "O'BRIEN & CO", type: "D", city: "" }, 2))
    .toBe("/admin/licensees?last=O%27BRIEN+%26+CO&type=D&page=2");
  expect(pageHref("/admin/licensees", { last: "50%" }, 1)).toBe("/admin/licensees?last=50%25");
  expect(pageHref("/admin/permits", {}, 1)).toBe("/admin/permits");
});
it("windows the page list", () => {
  expect(pageWindow(1, 1)).toEqual([1]);
  expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  expect(pageWindow(1, 772)).toEqual([1, 2, "gap", 772]);
  expect(pageWindow(400, 772)).toEqual([1, "gap", 399, 400, 401, "gap", 772]);
  expect(pageWindow(772, 772)).toEqual([1, "gap", 771, 772]);
});
it("describes the visible range", () => {
  expect(rangeText(3, 25, 19285, 25)).toBe("Showing 51–75 of 19,285");
  expect(rangeText(772, 25, 19285, 10)).toBe("Showing 19,276–19,285 of 19,285");
  expect(lastPage(19285)).toBe(772);
  expect(lastPage(0)).toBe(1);
});
it("appends LIMIT and a bound OFFSET", async () => {
  const f = fake([{ id: 1, total: "19285" }]);
  const r = await runPaged(f.query, "SELECT id, count(*) OVER() AS total FROM t WHERE a = $1", ["x"], 772, (row) => ({ id: row.id }));
  expect(f.calls[0].text).toMatch(/\nLIMIT 25 OFFSET \$2$/);
  expect(f.calls[0].params).toEqual(["x", 19275]);
  expect(r).toEqual({ rows: [{ id: 1 }], total: 19285, page: 772, pageSize: 25 });
});
it("falls back to page 1 when the page is past the last row", …); // 1st call returns [], 2nd [{…, total: "40"}]; calls[1].params ends with 0; r.page === 1, r.total === 40
it("does not query twice for an empty page 1", …);                // one call; { rows: [], total: 0, page: 1 }
it("converts row values", () => {
  expect(rowIso(new Date("2027-01-01T05:59:59Z"))).toBe("2027-01-01T05:59:59.000Z");
  expect(rowNum("19285")).toBe(19285);
  expect(rowNum(null)).toBeNull();
  expect(rowStr(undefined)).toBeNull();
  expect(rowBool(null)).toBeNull();
});
// source-text checks
it("the table is a server component built on the shared pagination", …); // server-table.tsx: no "use client"; contains "@/components/ui/pagination", "pageHref(" and "pageWindow("
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/staff-query.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `pageHref` builds the query with `URLSearchParams`, in the order of the object's keys, dropping empty values, adding `page` only when it is above 1. `ServerTable` renders `rangeText` (or `emptyText` when `total` is 0), the `Table`, and, when `lastPage > 1`, Previous / windowed page links / Next using `pageHref`; the pagination block carries `print:hidden`. No sorting controls.
- [ ] **Step 4: Run to verify pass**, then `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 5: Commit** — `feat(admin): server-paginated table and paging helpers`.

---

### Task 5: Licensee search loader and the SQL guard test

**Files:**
- Create: `src/lib/staff-licensees.ts`
- Test: `tests/app/staff-licensees.test.ts`, `tests/app/staff-sql-guard.test.ts`

**Interfaces:**
- Consumes: `RoQueryFn` (type, Task 1); `LICENSE_TYPES`, `LICENSE_STATUSES`, `StaffLicenseType`, `StaffLicenseStatus` (Task 3); `RawSearchParams`, `Paged`, `parsePage`, `cleanText`, `runPaged`, `rowStr`, `rowIso`, `rowNum` (Task 4); `escapeLike` from `./sql-like`; `STAFF_RO_TABLES` from `../../scripts/lib/staff-ro-tables` (test only; constants, no connection).
- Produces:

```ts
export type LicenseeFilters = {
  last: string; first: string; number: string;
  type: StaffLicenseType | ""; status: StaffLicenseStatus | "none" | ""; city: string; page: number;
};
export function parseLicenseeFilters(sp: RawSearchParams): LicenseeFilters; // query keys: last, first, number, type, status, city, page
export type LicenseeListRow = {
  key: number; lastName: string | null; firstName: string | null; middleName: string | null; suffix: string | null;
  hasLicence: boolean; licenseNumber: string | null; type: string | null; status: string | null; class: string | null;
  dateUntil: string | null; officeCity: string | null; duplicateCount: number;
};
export function searchLicensees(q: RoQueryFn, f: LicenseeFilters): Promise<Paged<LicenseeListRow>>;
```

The query (decisions: start from `person` so a person without a licence still lists; city means the **office** address; the tie-break makes paging stable):

```sql
SELECT p.legacy_key, p.last_name, p.first_name, p.middle_name, p.suffix,
       l.id AS license_row_id, l.license_id, l.type, l.status, l.class, l.date_until,
       (SELECT a.city FROM lsbd.person_address a WHERE a.person_id = p.id AND a.address_type = 'office') AS office_city,
       (SELECT count(*) FROM lsbd.license d WHERE d.type = l.type AND d.license_id = l.license_id) AS duplicate_count,
       count(*) OVER() AS total
FROM lsbd.person p
LEFT JOIN lsbd.license l ON l.legacy_key = p.legacy_key
[WHERE …]
ORDER BY p.last_name NULLS LAST, p.first_name NULLS LAST, p.legacy_key
```

Keep the two scalar subqueries on single lines, so the only line that starts with `WHERE` is the outer filter (a test relies on it). Filters, each added only when set: `last` → `(p.last_name ILIKE $n OR p.married_name ILIKE $n)` with `escapeLike(last) + "%"`; `first` → `p.first_name ILIKE $n` (prefix); `number` → `l.license_id = $n` (exact); `type` → `l.type = $n`; `status` → `l.status = $n`, or for `"none"` the literal `l.id IS NOT NULL AND l.status IS NULL`; `city` → `EXISTS (SELECT 1 FROM lsbd.person_address a WHERE a.person_id = p.id AND a.address_type = 'office' AND a.city ILIKE $n)` (prefix). No filter at all lists everyone.

- [ ] **Step 1: Write the failing tests.**

```ts
// staff-licensees.test.ts
it("parses and validates the filters", () => {
  expect(parseLicenseeFilters({ last: ["smith", "x"], type: "d", status: "cur", city: " Baton ", page: "-3" }))
    .toEqual({ last: "smith", first: "", number: "", type: "D", status: "", city: "Baton", page: 1 });
  expect(parseLicenseeFilters({ status: "NONE", type: "X" })).toMatchObject({ status: "none", type: "" });
  expect(parseLicenseeFilters({ status: "prb", page: "772" })).toMatchObject({ status: "PRB", page: 772 });
});
it("binds input as parameters and escapes LIKE wildcards", async () => {
  const f = fake([]);
  await searchLicensees(f.query, { ...NONE, last: "%", first: "a_b", city: "50%" });
  const { text, params } = f.calls[0];
  expect(params).toEqual(["\\%%", "a\\_b%", "50\\%%", 0]);
  expect(text).not.toContain("a_b");
  expect(text).toContain("p.married_name ILIKE");
  expect(text).toContain("a.address_type = 'office'");
});
it("lists everyone when no filter is set", …);        // text does not match /\nWHERE /; params toEqual([0]); text matches /LIMIT 25 OFFSET \$1$/
it("filters number, type and status exactly", …);     // { number: "2227", type: "H", status: "ACT" } -> params ["2227", "H", "ACT", 0]
it("filters licences with no status without a parameter", …); // status "none": text contains "l.id IS NOT NULL AND l.status IS NULL"; params [0]
it("orders with a unique tie-break", …);              // text matches /ORDER BY p\.last_name NULLS LAST, p\.first_name NULLS LAST, p\.legacy_key\n/
it("binds offset 19275 for page 772", …);
it("keeps a person who has no licence row", async () => {
  const f = fake([{ legacy_key: 77, last_name: "DOE", first_name: null, middle_name: null, suffix: null, license_row_id: null,
    license_id: null, type: null, status: null, class: null, date_until: null, office_city: null, duplicate_count: "0", total: "1" }]);
  const r = await searchLicensees(f.query, NONE);
  expect(r.rows[0]).toMatchObject({ key: 77, hasLicence: false, licenseNumber: null, duplicateCount: 0 });
});
it("maps a licence row", …);                          // date_until Date -> ISO string; duplicate_count "2" -> 2; no `total` property on the row

// staff-sql-guard.test.ts — reads every src/lib/staff-*.ts as text
it("finds staff modules", …);                         // at least one file
it("reads only relations granted to lsbd_staff_ro", () => {
  // every /\blsbd\.([a-z_]+)/g match is in STAFF_RO_TABLES, or is "individual",
  // or is one of the enum types "license_type" | "license_status" | "license_class" | "address_type"
});
it("never selects *", …);                             // no /SELECT\s+\*/i and no /\b[a-z][a-z0-9_]*\.\*/ in any file
it("never names a forbidden relation", …);            // none of: licensee_pii, person_practice_stats, lsbd_raw, transactions, transaction_splits, renewals, renewal_, complaint, logins, lsbd.users
it("never selects PII columns of lsbd.individual", …);// a file matching /\blsbd\.individual\b(?!_)/ has no /\b(ssn|dob|sex|race)\b/
it("goes through withStaffRo only", …);               // no file contains 'from "@/lib/db"', 'from "./db"', "db.execute", "db.select" or "db.$client";
                                                      // only staff-data.ts may contain "withStaffRo"
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/staff-licensees.test.ts tests/app/staff-sql-guard.test.ts` → FAIL.
- [ ] **Step 3: Implement `src/lib/staff-licensees.ts`** from the signatures, SQL and filter rules above. `type` and `status` are upper-cased and kept only if in `LICENSE_TYPES` / `LICENSE_STATUSES` (`none` in any case → `"none"`); text fields go through `cleanText`.
- [ ] **Step 4: Run to verify pass**, then `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 5: Commit** — `feat(staff): licensee search loader and SQL allow-list guard`.

---

### Task 6: Licensee detail, part 1 (person, licence, other licences, addresses, education)

**Files:**
- Create: `src/lib/staff-licensee-detail.ts`
- Test: `tests/app/staff-licensee-detail.test.ts`

**Interfaces:**
- Consumes: `RoQueryFn` (type); `rowStr`, `rowIso`, `rowNum`, `rowBool` (Task 4); `centralDayKey` from `./central-time`.
- Produces:

```ts
export type DetailCaps = { contact: boolean; discipline: boolean }; // contact = pii.read, discipline = discipline.read
export type Linked<T> = { linked: true; rows: T[] } | { linked: false; reason: string };
export type LicenseePerson = {
  key: number; personId: number; individualId: string | null;
  firstName: string | null; middleName: string | null; lastName: string | null; licenseName: string | null;
  marriedName: string | null; prefix: string | null; suffix: string | null; useLicenseName: boolean;
};
export type LicenseeContact = { email: string | null; url: string | null; phone1: string | null; ext1: string | null; phone2: string | null; ext2: string | null; fax: string | null };
export type LicenceRecord = {
  licenseNumber: string; type: string | null; class: string | null; status: string | null;
  dateSince: string | null; dateInactive: string | null; dateReinstate: string | null; dateRenew: string | null; dateUntil: string | null;
  regYear: string | null; renewMonth: string | null; paNumber: string | null; pllcNumber: string | null; permitNumber: string | null;
  isCurrent: boolean | null; action: string | null; credentialExam: string | null; duplicateCount: number;
};
export type OtherLicence = { key: number; licenseNumber: string; type: string | null; status: string | null; dateUntil: string | null };
export type AddressRow = { type: "home" | "office" | "permanent"; line1: string | null; line2: string | null; line3: string | null; city: string | null; state: string | null; zip: string | null; county: string | null; country: string | null };
export type EducationRow = { source: "licence-record" | "education-table"; school: string | null; state: string | null; year: number | null; degree: string | null; boardCertified: boolean | null; certifiedBy: string | null };
export type LicenseeCore = {
  person: LicenseePerson; contact: LicenseeContact | null; licence: LicenceRecord | null;
  otherLicences: Linked<OtherLicence>; addresses: AddressRow[]; education: EducationRow[];
};
export const NO_INDIVIDUAL_REASON = "This record has no link to an individual record, so this cannot be looked up here. Check Access.";
export function parseLicenseeKey(raw: string): number | null;   // /^[1-9]\d{0,9}$/ and <= 2147483647, else null
export function loadLicenseeCore(q: RoQueryFn, key: number, caps: DetailCaps): Promise<LicenseeCore | null>;
```

Queries, run one after another:

1. Person and licence, `WHERE p.legacy_key = $1`, from `lsbd.person p LEFT JOIN lsbd.license l ON l.legacy_key = p.legacy_key`, selecting the `LicenseePerson` columns, the `LicenceRecord` columns (`l.id AS license_row_id` to tell "no licence"), and the same `duplicate_count` subquery as Task 5. The seven `LicenseeContact` columns are in the select list **only when `caps.contact`**. No row → return `null` without further queries.
2. Other licences of the same individual, only when `individualId` is not null: `SELECT p2.legacy_key, l2.license_id, l2.type, l2.status, l2.date_until FROM lsbd.person p2 JOIN lsbd.license l2 ON l2.legacy_key = p2.legacy_key WHERE p2.individual_id = $1 AND p2.legacy_key <> $2 ORDER BY l2.type, l2.date_since NULLS LAST LIMIT 50`. When it is null: `{ linked: false, reason: NO_INDIVIDUAL_REASON }` and no query.
3. Addresses: `SELECT address_type, line1, line2, line3, city, state, zip, county, country FROM lsbd.person_address WHERE person_id = $1 ORDER BY address_type`, with `AND address_type = 'office'` added when `!caps.contact`.
4. Education from the licence record: `SELECT school_name, school_state, grad_year, degree FROM lsbd.person_education WHERE person_id = $1` → `source: "licence-record"`, `degree` = the raw code as a string (Q5), `year` = `grad_year`.
5. Education table (**unverified join U4**): `SELECT e.school, COALESCE(s.state, e.state) AS state, e.graduation_date, COALESCE(et.education_type, e.edu_type) AS degree, e.board_certified, e.certified_by FROM lsbd.education e LEFT JOIN lsbd.education_type et ON et.id = e.education_type_id LEFT JOIN lsbd.states s ON s.id = e.school_state_id WHERE e.den_hyg_id = $1 ORDER BY e.graduation_date NULLS LAST, e.id LIMIT 100` with `$1` = the legacy key → `source: "education-table"`, `year` = the Central year of `graduation_date` (via `centralDayKey` from `./central-time`).

- [ ] **Step 1: Write the failing tests** (a fake that answers by matching a substring of the SQL text).

```ts
it("accepts only a positive 32-bit integer key", () => {
  expect(parseLicenseeKey("12345")).toBe(12345);
  for (const v of ["0", "-1", "1.5", "abc", "", "01", "2147483648", "1 OR 1=1", "%25E0"]) expect(parseLicenseeKey(v)).toBeNull();
});
it("returns null for an unknown key after one query", …);                    // calls.length === 1; params [999]
it("renders a person who has no licence row", …);                            // license_row_id null -> core.licence === null; the other sections still load
it("does not query or return contact fields without pii.read", async () => {
  const f = fakeFor(person);
  const core = await loadLicenseeCore(f.query, 12345, { contact: false, discipline: false });
  expect(core!.contact).toBeNull();
  expect(f.calls[0].text).not.toMatch(/email|phone1|fax/);
  expect(f.textMatching("lsbd.person_address")).toContain("address_type = 'office'");
});
it("returns contact fields and every address with pii.read", …);             // contact object set; address SQL has no "address_type = 'office'"
it("says other licences cannot be looked up when individual_id is NULL", …); // otherLicences toEqual({ linked: false, reason: NO_INDIVIDUAL_REASON }); no call containing "p2.individual_id"
it("lists other licences of the same individual, excluding this one", …);    // params [uuid, 12345]
it("keeps the licence-record school when the education table has no linked row", …); // education toEqual([{ source: "licence-record", … }])
it("binds the legacy key for the education table and takes the Central year", …);    // graduation_date 2001-05-15T05:00:00Z -> year 2001; params [12345]
it("carries duplicateCount onto the licence", …);                            // duplicate_count "2" -> 2
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/staff-licensee-detail.test.ts` → FAIL.
- [ ] **Step 3: Implement** from the signatures and the five queries above.
- [ ] **Step 4: Run to verify pass**, then `npx vitest run tests/app/staff-sql-guard.test.ts` (must still pass), `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 5: Commit** — `feat(staff): licensee detail loader (licence, addresses, education)`.

---

### Task 7: Permits loader

**Files:**
- Create: `src/lib/staff-permits.ts`
- Test: `tests/app/staff-permits.test.ts`

**Interfaces:**
- Consumes: `RoQueryFn` (type); `RawSearchParams`, `Paged`, `parsePage`, `cleanText`, `runPaged`, `rowStr`, `rowIso`, `rowNum` (Task 4); `formatPersonName` (Task 3).
- Produces:

```ts
export type PermitKind = "personal" | "office";
export function permitKind(officeId: number | null): PermitKind;   // "office" when officeId > 0 (the Access rule); otherwise "personal"
export type PermitFilters = { kind: PermitKind | ""; type: string; level: string; page: number };
export function parsePermitFilters(sp: RawSearchParams): PermitFilters; // query keys: kind, type, level, page
export type PermitRow = {
  id: number; kind: PermitKind;
  typeName: string | null; typeLinked: boolean; level: string | null; description: string | null; issueDate: string | null;
  dentistId: number | null; holderKey: number | null; holderName: string | null; holderLicenseNumber: string | null; holderType: string | null;
  officeId: number | null; firmId: number | null; firmName: string | null;
};
/** Unverified join U1, kept in one place. */
export const PERMIT_FIRM_JOIN = "LEFT JOIN lsbd.professional_llc f ON pm.office_id > 0 AND f.id = pm.office_id";
export function listPermits(q: RoQueryFn, f: PermitFilters): Promise<Paged<PermitRow>>;
export function permitFilterOptions(q: RoQueryFn): Promise<{ types: string[]; levels: string[] }>;
export function permitsForHolder(q: RoQueryFn, legacyKey: number): Promise<PermitRow[]>; // LIMIT 200
export function permitsForFirm(q: RoQueryFn, firmId: number): Promise<PermitRow[]>;      // U1; LIMIT 500
```

Shared select (all three row functions use it; `listPermits` adds `count(*) OVER() AS total`):

```sql
SELECT pm.id, pm.permit_type_id, COALESCE(pt.permit_type, pm.permit_type_name) AS type_name,
       pm.permit_level, pm.description, pm.issue_date, pm.dentist_id, pm.office_id,
       p.legacy_key AS holder_key, p.last_name, p.first_name, p.middle_name, p.suffix,
       l.license_id AS holder_license_id, l.type AS holder_type,
       f.id AS firm_id, f.est_name AS firm_name
FROM lsbd.permits pm
LEFT JOIN lsbd.permit_type pt ON pt.id = pm.permit_type_id
LEFT JOIN lsbd.person p ON p.legacy_key = pm.dentist_id
LEFT JOIN lsbd.license l ON l.legacy_key = p.legacy_key
<PERMIT_FIRM_JOIN>
```

Rules: `typeLinked` is true only when `permit_type_id` is not null and `pt` matched; `typeName` falls back to `permits.permit_type_name` and is `null` when both are missing. `holderKey`/`holderName` are `null` when `dentist_id` is NULL or matches no person (`dentistId` keeps the raw value for display). Filters: `kind = "office"` → `pm.office_id > 0`; `kind = "personal"` → `(pm.office_id IS NULL OR pm.office_id <= 0)`; `type` → `COALESCE(pt.permit_type, pm.permit_type_name) = $n`; `level` → `pm.permit_level = $n`. List order: `ORDER BY p.last_name NULLS LAST, p.first_name NULLS LAST, pm.id`. `permitsForHolder`: `WHERE pm.dentist_id = $1 ORDER BY pm.issue_date DESC NULLS LAST, pm.id`. `permitsForFirm`: `WHERE pm.office_id = $1 AND pm.office_id > 0`, same order as the list. Options: `SELECT DISTINCT COALESCE(pt.permit_type, pm.permit_type_name) AS name FROM lsbd.permits pm LEFT JOIN lsbd.permit_type pt ON pt.id = pm.permit_type_id WHERE COALESCE(pt.permit_type, pm.permit_type_name) IS NOT NULL ORDER BY 1` and `SELECT DISTINCT permit_level FROM lsbd.permits WHERE permit_level IS NOT NULL ORDER BY 1`. Anesthesia and sedation permits are found with the type filter; `sed_level` is not joined (Q5).

- [ ] **Step 1: Write the failing tests.**

```ts
it("splits personal and office on office_id > 0", () => {
  expect(permitKind(null)).toBe("personal"); expect(permitKind(0)).toBe("personal");
  expect(permitKind(-1)).toBe("personal");   expect(permitKind(3810)).toBe("office");
});
it("parses the filters", () => {
  expect(parsePermitFilters({ kind: "OFFICE", type: " Nitrous ", level: "P", page: "2" })).toEqual({ kind: "office", type: "Nitrous", level: "P", page: 2 });
  expect(parsePermitFilters({ kind: "both" })).toMatchObject({ kind: "" });
});
it("filters office permits with office_id > 0 and personal with the complement", …);
  // office: text contains "WHERE pm.office_id > 0"; personal: "(pm.office_id IS NULL OR pm.office_id <= 0)"; neither adds a parameter
it("binds type and level and compares the type by its fallback name", …);
  // params ["Nitrous", "P", 0]; text contains "COALESCE(pt.permit_type, pm.permit_type_name) = $1"
it("falls back to permits.permit_type_name when the type link is NULL", …);
  // row { permit_type_id: null, type_name: "General Anesthesia" } -> { typeName: "General Anesthesia", typeLinked: false }
it("reports a missing type as null, not a guess", …);       // permit_type_id null, type_name null -> typeName null, typeLinked false
it("marks the holder not linked for a NULL or dangling dentist_id", …);
  // { dentist_id: null, holder_key: null } -> holderKey null, holderName null, dentistId null
  // { dentist_id: 99999, holder_key: null } -> holderKey null, dentistId 99999
it("names a linked holder last-first and classifies the row", …); // holderName "SMITH, John"; office_id 3810 -> kind "office", firmName from firm_name
it("uses the one firm join constant", …);                    // every query text that selects f.est_name contains PERMIT_FIRM_JOIN
it("binds the holder key / firm id", …);                     // permitsForHolder params [12345]; permitsForFirm params [3810]
it("returns sorted distinct filter options", …);             // two calls; { types: ["General Anesthesia", "Nitrous"], levels: ["P"] }
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/staff-permits.test.ts` → FAIL.
- [ ] **Step 3: Implement** from the signatures, shared select and rules above. `kind` is lower-cased and kept only if `personal` or `office`.
- [ ] **Step 4: Run to verify pass**, then the guard test, `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 5: Commit** — `feat(staff): permits loader with personal/office split and type fallback`.

---

### Task 8: Firms loader

**Files:**
- Create: `src/lib/staff-firms.ts`
- Test: `tests/app/staff-firms.test.ts`

**Interfaces:**
- Consumes: `RoQueryFn` (type); `RawSearchParams`, `Paged`, `parsePage`, `cleanText`, `runPaged`, `rowStr`, `rowIso`, `rowNum` (Task 4); `escapeLike`; `formatPersonName` (Task 3).
- Produces:

```ts
export type FirmFilters = { name: string; number: string; city: string; status: string; page: number };
export function parseFirmFilters(sp: RawSearchParams): FirmFilters; // query keys: name, number, city, status, page
export type FirmListRow = { id: number; number: string | null; name: string | null; status: string | null; type: string | null; city: string | null; state: string | null; dateUntil: string | null };
export type FirmDetail = FirmListRow & {
  dateSince: string | null; dateRenew: string | null; dateUpdated: string | null; regYear: string | null; renewMonth: string | null;
  addrName1: string | null; addrName2: string | null; address1: string | null; address2: string | null; address3: string | null;
  zip: string | null; county: string | null; phone1: string | null; ext1: string | null; phone2: string | null; ext2: string | null;
  fax: string | null; email: string | null; url: string | null; location: string | null; officeId: number | null;
};
export type FirmLicensee = { key: number; name: string; licenseNumber: string; type: string | null; status: string | null };
export type FirmLink = { kind: "PLLC" | "PA"; number: string; firmId: number | null; firmName: string | null };
export function parseFirmId(raw: string): number | null;               // same rule as parseLicenseeKey
export function listFirms(q: RoQueryFn, f: FirmFilters): Promise<Paged<FirmListRow>>;
export function firmStatusOptions(q: RoQueryFn): Promise<string[]>;
export function getFirm(q: RoQueryFn, id: number): Promise<FirmDetail | null>;
export function countProfessionalAssociations(q: RoQueryFn): Promise<number>;
export function licenseesForFirmNumber(q: RoQueryFn, number: string): Promise<FirmLicensee[]>;                   // U3 reversed; LIMIT 200
export function firmLinksForLicence(q: RoQueryFn, pllcNumber: string | null, paNumber: string | null): Promise<FirmLink[]>; // U3
```

Rules: everything reads `lsbd.professional_llc` (columns named explicitly; never `notes`, `comment1`–`comment3`, D8). Filters: `name` → `est_name ILIKE $n` with `"%" + escapeLike(name) + "%"` (contains); `number` → `license_id = $n`; `city` → `city ILIKE $n` (prefix); `status` → `status = $n`. Order: `ORDER BY est_name NULLS LAST, id`. `firmStatusOptions`: `SELECT DISTINCT status FROM lsbd.professional_llc WHERE status IS NOT NULL ORDER BY 1`. `countProfessionalAssociations`: `SELECT count(*) AS n FROM lsbd.professional_association`. `licenseesForFirmNumber`: `FROM lsbd.license l JOIN lsbd.person p ON p.legacy_key = l.legacy_key WHERE btrim(l.pllc_number) = $1 ORDER BY p.last_name NULLS LAST, p.first_name NULLS LAST, p.legacy_key LIMIT 200`. `firmLinksForLicence` (**unverified join U3**): for a non-blank trimmed `pllcNumber`, `SELECT id, est_name FROM lsbd.professional_llc WHERE license_id = $1 ORDER BY id LIMIT 5` → one `FirmLink` per match, or a single `{ kind: "PLLC", number, firmId: null, firmName: null }` when nothing matches; the same for `paNumber` against `lsbd.professional_association` with `kind: "PA"`. A null or blank number sends no query and yields no link.

- [ ] **Step 1: Write the failing tests.**

```ts
it("parses the filters", …);                                   // { name: " smile ", page: "abc" } -> name "smile", page 1
it("searches the name as an escaped contains match", async () => {
  const f = fake([]);
  await listFirms(f.query, { ...NONE, name: "100%_dental", city: "Baton" });
  expect(f.calls[0].params).toEqual(["%100\\%\\_dental%", "Baton%", 0]);
  expect(f.calls[0].text).toContain("FROM lsbd.professional_llc");
});
it("filters number and status exactly", …);                    // params ["160179", "CUR", 0]
it("orders by name with a unique tie-break", …);               // /ORDER BY est_name NULLS LAST, id\n/
it("never selects notes or comments", …);                      // no query text from any function contains "notes" or "comment"
it("returns null for an unknown firm", …);                     // getFirm -> null; params [3810]
it("maps a firm", …);                                          // date_until Date -> ISO; office_id "12" -> 12
it("counts professional associations", …);                     // [{ n: "0" }] -> 0
it("links a licence to its PLLC by trimmed number", …);        // firmLinksForLicence(q, " 160179 ", null) -> params ["160179"]; [{ kind: "PLLC", number: "160179", firmId: 3810, firmName: "X" }]
it("reports an unmatched number as not linked", …);            // [] -> [{ kind: "PLLC", number: "160179", firmId: null, firmName: null }]
it("sends no query for missing numbers", …);                   // (null, "  ") -> []; calls.length === 0
it("reports a PA number as not linked while the table is empty", …); // (null, "55") -> [{ kind: "PA", number: "55", firmId: null, firmName: null }]
it("lists the licensees that name a firm number", …);          // params ["160179"]; name "SMITH, John"
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/staff-firms.test.ts` → FAIL.
- [ ] **Step 3: Implement** from the signatures and rules above.
- [ ] **Step 4: Run to verify pass**, then the guard test, `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 5: Commit** — `feat(staff): firms loader (PLLC list, detail, firm links)`.

---

### Task 9: Licensee detail, part 2 (permits, affiliations, offices, firm links, discipline)

**Files:**
- Modify: `src/lib/staff-licensee-detail.ts`
- Test: `tests/app/staff-licensee-detail.test.ts` (add a `describe("relations")`)

**Interfaces:**
- Consumes: `LicenseeCore`, `DetailCaps`, `Linked`, `NO_INDIVIDUAL_REASON`, `loadLicenseeCore` (Task 6); `permitsForHolder`, `PermitRow` (Task 7); `firmLinksForLicence`, `FirmLink` (Task 8); `formatPersonName` (Task 3).
- Produces:

```ts
export type AffiliationRow = {
  direction: "dentist-of" | "affiliated-to";   // this licensee is the dentist | this licensee is the affiliated individual
  otherKey: number | null;                     // the raw legacy id on the affiliation row
  otherName: string | null; otherLicenseNumber: string | null; otherType: string | null; // null when no person has that key
};
export type OfficeLinkRow = { id: number; officePermit: boolean | null; officeId: number | null; officeName: string | null; officePhone: string | null };
export type DisciplineRow = { startDate: string | null; endDate: string | null; goodStanding: boolean | null; notes: string | null };
export type LicenseeRelations = {
  permits: PermitRow[]; affiliations: AffiliationRow[]; offices: OfficeLinkRow[]; firmLinks: FirmLink[];
  discipline: Linked<DisciplineRow> | "hidden";
};
export type LicenseeDetail = LicenseeCore & LicenseeRelations;
export function loadLicenseeRelations(q: RoQueryFn, core: LicenseeCore, caps: DetailCaps): Promise<LicenseeRelations>;
export function loadLicenseeDetail(q: RoQueryFn, key: number, caps: DetailCaps): Promise<LicenseeDetail | null>;
```

Queries, run one after another (`$1` = `core.person.key` unless stated):

1. `permitsForHolder(q, key)`.
2. Affiliations where this licensee is the dentist: `SELECT ia.individual_legacy_id AS other_key, o.legacy_key AS found_key, o.last_name, o.first_name, o.middle_name, o.suffix, ol.license_id, ol.type FROM lsbd.individual_affiliation ia LEFT JOIN lsbd.person o ON o.legacy_key = ia.individual_legacy_id LEFT JOIN lsbd.license ol ON ol.legacy_key = o.legacy_key WHERE ia.dentist_legacy_id = $1 ORDER BY o.last_name NULLS LAST, ia.id LIMIT 200` → `direction: "dentist-of"`.
3. The mirror: `WHERE ia.individual_legacy_id = $1`, joining `o` on `ia.dentist_legacy_id` (also selected as `other_key`) → `direction: "affiliated-to"`.
4. Offices (U2): `SELECT oa.id, oa.office_permit, oa.office_id, o.office_name, o.phone FROM lsbd.office_affiliation oa LEFT JOIN lsbd.office o ON o.id = oa.office_id WHERE oa.dentist_id = $1 ORDER BY oa.id LIMIT 200`.
5. `firmLinksForLicence(q, core.licence?.pllcNumber ?? null, core.licence?.paNumber ?? null)`.
6. Discipline: `caps.discipline` false → `"hidden"`, **no query**. `core.person.individualId` null → `{ linked: false, reason: NO_INDIVIDUAL_REASON }`, no query. Otherwise `SELECT start_date, end_date, good_standing, notes FROM lsbd.disciplinary WHERE individual_id = $1 ORDER BY start_date DESC NULLS LAST, legacy_id DESC LIMIT 100` with `$1` = the individual uuid.

`loadLicenseeDetail` returns `null` when `loadLicenseeCore` does, without running any relation query.

- [ ] **Step 1: Write the failing tests.**

```ts
it("sends no discipline query without discipline.read", async () => {
  const f = fakeFor(coreWithIndividual);
  const r = await loadLicenseeRelations(f.query, coreWithIndividual, { contact: true, discipline: false });
  expect(r.discipline).toBe("hidden");
  expect(f.calls.some((c) => c.text.includes("lsbd.disciplinary"))).toBe(false);
});
it("says discipline cannot be looked up when individual_id is NULL", …);
  // caps.discipline true, individualId null -> { linked: false, reason: NO_INDIVIDUAL_REASON }; no disciplinary query
it("loads discipline by the individual uuid, newest first", …);   // params [uuid]; { linked: true, rows: [{ goodStanding: false, notes: "…" }] }
it("returns an empty linked list when the individual has no discipline", …); // { linked: true, rows: [] }
it("lists affiliations in both directions", …);                   // two queries: "ia.dentist_legacy_id = $1" and "ia.individual_legacy_id = $1"; both params [12345]
it("keeps an affiliation whose other person does not exist", …);  // found_key null -> { otherKey: 4242, otherName: null, otherLicenseNumber: null }
it("keeps an office affiliation with a NULL office", …);          // office_id null -> { officeId: null, officeName: null }
it("passes the licence's PLLC and PA numbers to the firm lookup", …); // a query against professional_llc with params ["160179"]
it("skips the firm lookup when there is no licence row", …);      // core.licence null -> firmLinks []; no professional_llc query
it("loadLicenseeDetail returns null for an unknown key and runs one query", …);
it("loadLicenseeDetail merges core and relations", …);            // result has both `licence` and `permits`
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/staff-licensee-detail.test.ts` → FAIL (new tests).
- [ ] **Step 3: Implement** from the signatures and the six steps above.
- [ ] **Step 4: Run to verify pass**, then the guard test, `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 5: Commit** — `feat(staff): licensee detail relations (permits, affiliations, firms, discipline)`.

---

### Task 10: Licensee pages, the `staff-data` binding, sidebar, gates

**Files:**
- Create: `src/lib/staff-data.ts`, `src/app/admin/licensees/page.tsx`, `src/app/admin/licensees/[key]/page.tsx`, `src/components/admin/oddity-badges.tsx`, `src/components/admin/print-button.tsx`
- Modify: `src/components/admin/admin-sidebar.tsx`, `tests/app/admin-gates.test.ts`

**Interfaces:**
- Consumes: `withStaffRo` (Task 1); `requireCapability` (`@/lib/auth-utils`), `can` (`@/lib/auth-capabilities`); `parseLicenseeFilters`, `searchLicensees`, `LicenseeFilters`, `LicenseeListRow` (Task 5); `parseLicenseeKey`, `loadLicenseeDetail`, `LicenseeDetail` (Tasks 6, 9); `Paged`, `RawSearchParams`, `STAFF_PAGE_SIZE` (Task 4); `ServerTable`, `NotLinked` (Task 4); labels and `licenceOddities`, `ODDITY_LABELS` (Task 3); `formatCentralDate`, `formatCentralDateTime`.
- Produces:

```ts
// src/lib/staff-data.ts — the only module that calls withStaffRo. Each function: requireCapability first, then one withStaffRo.
export function getLicenseeList(sp: RawSearchParams): Promise<{ filters: LicenseeFilters; result: Paged<LicenseeListRow> }>;      // "licensees.read"
export function getLicenseeDetail(rawKey: string): Promise<{ detail: LicenseeDetail; caps: DetailCaps } | null>;                    // "licensees.read"; null for a bad key or no row
// src/components/admin/oddity-badges.tsx (server component)
export function OddityBadges(props: { oddities: LicenceOddity[] }): React.JSX.Element | null; // one amber outline Badge per oddity, text from ODDITY_LABELS
// src/components/admin/print-button.tsx ("use client")
export function PrintButton(): React.JSX.Element; // Button "Print fact sheet", onClick window.print(), className includes print:hidden
```

`getLicenseeDetail` builds `caps` from the session returned by `requireCapability`: `{ contact: can(session.user.role, "pii.read"), discipline: can(session.user.role, "discipline.read") }`, **before** calling `withStaffRo` (D3).

- [ ] **Step 1: Extend `tests/app/admin-gates.test.ts`** with a `describe("staff data gates")` (source-text checks in the file's existing style):

```ts
const STAFF_PAGES: Record<string, string> = {
  "src/app/admin/licensees/page.tsx": 'requireCapability("licensees.read")',
  "src/app/admin/licensees/[key]/page.tsx": 'requireCapability("licensees.read")',
};
it("each staff page gates on its capability before loading data", …);
  // file exists; contains the gate string; indexOf(gate) < indexOf("await getLicensee"); contains 'dynamic = "force-dynamic"'
it("every staff-data function checks a capability before opening the transaction", …);
  // split src/lib/staff-data.ts on "export async function "; each part has "requireCapability(" at a lower index than "withStaffRo("
it("no auth or db call sits inside a withStaffRo callback", …);
  // in each part, the text after "withStaffRo(" contains none of "requireCapability(", "auth(", "db."
it("section capabilities come from the session role", …);
  // staff-data.ts contains 'can(session.user.role, "pii.read")' and 'can(session.user.role, "discipline.read")'
it("staff pages never touch the db client or format dates themselves", …);
  // every .tsx under src/app/admin/licensees: no "@/lib/db", "withStaffRo", "toLocaleDateString(", "toLocaleString("
it("the sidebar links staff screens by capability", …);
  // admin-sidebar.tsx contains 'href: "/admin/licensees"' followed on the same line by 'capability: "licensees.read"'
it("the detail page is the printable fact sheet", …);
  // [key]/page.tsx contains "PrintButton", "print:block", "break-inside-avoid", "notFound()", "NotLinked", "OddityBadges"
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/admin-gates.test.ts` → FAIL (files missing).
- [ ] **Step 3: Implement `src/lib/staff-data.ts`** (two functions above) and the two small components.
- [ ] **Step 4: Implement `/admin/licensees`** (`page.tsx`, server component, `metadata.title = "Licensees | Admin"`, `dynamic = "force-dynamic"`): `await requireCapability("licensees.read")`, `await searchParams`, `getLicenseeList(sp)` inside try/catch (on error `console.error` and the red `role="alert"` box "Could not read licensee records from the database."). A plain GET `<form action="/admin/licensees">` with `Input`s `last` (label "Last or married name"), `first`, `number` (label "Licence number"), `city` (label "Office city"), native `<select>`s `type` (All + `LICENSE_TYPES` with `typeLabel`) and `status` (All + `LICENSE_STATUSES` with `statusLabel` + `none` = "No status"), a Search button and a "Clear" link; no `page` field, so a new search starts at page 1. `ServerTable` columns: Name (`formatPersonName`, `Link` to `/admin/licensees/${key}`), Licence no., Type, Status (label + `OddityBadges` from `licenceOddities(row, new Date())`), Class, Expires (`formatCentralDate`), Office city. A row with `hasLicence === false` shows "No licence record" across the licence columns. `params` passed to `ServerTable` are the six filter values; `emptyText` "No licensees match these filters."
- [ ] **Step 5: Implement `/admin/licensees/[key]`**: `await requireCapability("licensees.read")`; `const { key } = await params`; `getLicenseeDetail(key)`; `notFound()` when null; same error box on a thrown error. Layout, in this order, each section a `Card` with `break-inside-avoid`:
  - Print-only header (`hidden print:block`): "Louisiana State Board of Dentistry — Licensee fact sheet", the name, "Record key N", "Printed " + `formatCentralDateTime(new Date())`. On screen: back link, name heading, `PrintButton`.
  - **Licence**: every `LicenceRecord` field with `typeLabel` / `statusLabel` / `classLabel`, dates through `formatCentralDate`, `OddityBadges`; or "No licence record exists for this person." when `licence` is null.
  - **Other licences of this individual**: linked rows as links to their own detail page; "None." for an empty linked list; `NotLinked` with the reason when not linked.
  - **Contact** (only when `contact` is not null).
  - **Addresses** with `ADDRESS_TYPE_LABELS`; when `caps.contact` is false add the line "Home and permanent addresses are not shown for your role."
  - **Education**: the licence-record row (degree shown as "Degree code N") and the education-table rows; when there are no education-table rows, "No education-table rows are linked to this record."
  - **Permits**: two sub-lists split on `kind`; type shows `typeName` (plus "(type not linked)" when `typeLinked` is false) or `NotLinked`; office permits show the firm as a link to `/admin/firms/${firmId}` or "Office #N" + `NotLinked`.
  - **Affiliations**: two sub-lists by `direction`; the other person as a link, or "Key N" + `NotLinked`.
  - **Offices**: office name and phone, or `NotLinked`; "Office permit: yes/no".
  - **Firm links**: `kind` + number, linked firm name as a link or `NotLinked`.
  - **Discipline**: omitted entirely when `"hidden"`; `NotLinked` with the reason when not linked; "No discipline records are linked to this individual." for an empty list; otherwise start, end, good standing, notes. Below it, always: "Discipline records without an individual link in the source do not appear on any licensee. Access remains the record until go-live."
- [ ] **Step 6: Add the sidebar item** directly after Dashboard: `{ label: "Licensees", href: "/admin/licensees", icon: BadgeCheck, capability: "licensees.read" }` (`BadgeCheck` from `lucide-react`).
- [ ] **Step 7: Run to verify pass.** `npx vitest run tests/app/admin-gates.test.ts tests/app/staff-sql-guard.test.ts` → PASS; then `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 8: Commit** — `feat(admin): read-only licensee list and printable detail page`.

---

### Task 11: Permits and firms pages

**Files:**
- Create: `src/app/admin/permits/page.tsx`, `src/app/admin/firms/page.tsx`, `src/app/admin/firms/[id]/page.tsx`
- Modify: `src/lib/staff-data.ts`, `src/components/admin/admin-sidebar.tsx`, `tests/app/admin-gates.test.ts`

**Interfaces:**
- Consumes: `withStaffRo`; `requireCapability`; `parsePermitFilters`, `listPermits`, `permitFilterOptions`, `permitsForFirm`, `PermitFilters`, `PermitRow` (Task 7); `parseFirmFilters`, `listFirms`, `firmStatusOptions`, `parseFirmId`, `getFirm`, `countProfessionalAssociations`, `licenseesForFirmNumber`, `FirmFilters`, `FirmListRow`, `FirmDetail`, `FirmLicensee` (Task 8); `ServerTable`, `NotLinked`, labels, `formatCentralDate`.
- Produces (added to `src/lib/staff-data.ts`, all `requireCapability("permits.read")` then one `withStaffRo`):

```ts
export function getPermitList(sp: RawSearchParams): Promise<{ filters: PermitFilters; options: { types: string[]; levels: string[] }; result: Paged<PermitRow> }>;
export function getFirmList(sp: RawSearchParams): Promise<{ filters: FirmFilters; statuses: string[]; associationCount: number; result: Paged<FirmListRow> }>;
export function getFirmDetail(rawId: string): Promise<{ firm: FirmDetail; permits: PermitRow[]; licensees: FirmLicensee[] } | null>;
```

`getFirmDetail` returns `null` for a bad id or no row; `licensees` is `[]` without a query when `firm.number` is null.

- [ ] **Step 1: Extend `tests/app/admin-gates.test.ts`**: add to `STAFF_PAGES` `"src/app/admin/permits/page.tsx"`, `"src/app/admin/firms/page.tsx"`, `"src/app/admin/firms/[id]/page.tsx"`, each with `'requireCapability("permits.read")'` (the ordering check compares against `await getPermit` / `await getFirm`); widen the "never touch the db client" test to `src/app/admin/permits` and `src/app/admin/firms`; and add:

```ts
it("the sidebar links permits and firms by capability", …);
  // 'href: "/admin/permits"' … 'capability: "permits.read"' and 'href: "/admin/firms"' … 'capability: "permits.read"'
it("the firms page states the professional-association empty state", …);
  // firms/page.tsx contains "No professional associations are on record" and "associationCount"
it("the permits page offers the personal/office split and the two filters", …);
  // permits/page.tsx contains 'name="kind"', 'name="type"', 'name="level"' and "NotLinked"
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run tests/app/admin-gates.test.ts` → FAIL.
- [ ] **Step 3: Add the three functions to `src/lib/staff-data.ts`.**
- [ ] **Step 4: Implement `/admin/permits`** (title "Permits | Admin", same page skeleton and error box as Task 10, message "Could not read permit records from the database."). GET form: `kind` select (All / Personal / Office), `type` select from `options.types`, `level` select from `options.levels`. Intro line: "Anesthesia and sedation permits are found with the Type filter." Columns: Holder (link to `/admin/licensees/${holderKey}`; when `holderKey` is null, `NotLinked` with detail "Dentist id N" or "no dentist id"), Licence no., Kind, Type (`typeName`, "(type not linked)" when `typeLinked` is false, `NotLinked` when null), Level, Issued, Firm (office permits only: link to `/admin/firms/${firmId}`, else "Office #N" + `NotLinked`). `emptyText` "No permits match these filters."
- [ ] **Step 5: Implement `/admin/firms`** (title "Firms | Admin"; error message "Could not read firm records from the database."). GET form: `name` ("Name contains"), `number` ("Registration number"), `city`, `status` select from `statuses`. Columns: Name (link to `/admin/firms/${id}`), Number, Type, Status (raw value), City, State, Expires. Below the table a "Professional associations" `Card`: when `associationCount === 0`, "No professional associations are on record (the source table is empty)."; otherwise "N professional association records exist. This screen does not list them yet."
- [ ] **Step 6: Implement `/admin/firms/[id]`**: gate, `await params`, `getFirmDetail(id)`, `notFound()` when null. Cards: **Firm** (every `FirmDetail` field, dates through `formatCentralDate`); **Office permits at this firm** (`permits`; holder link or `NotLinked`; when empty "No office permits are linked to this firm."; caption "Linked by office id (unverified link U1)."); **Licensees naming this registration number** (`licensees` as links; when empty "No licensee record names this number."). Add `PrintButton` and `break-inside-avoid` as on the licensee page.
- [ ] **Step 7: Add the sidebar items** after Licensees: `{ label: "Permits", href: "/admin/permits", icon: FileBadge, capability: "permits.read" }`, `{ label: "Firms", href: "/admin/firms", icon: Building2, capability: "permits.read" }`.
- [ ] **Step 8: Run to verify pass.** `npx vitest run tests/app/admin-gates.test.ts tests/app/staff-sql-guard.test.ts` → PASS; then `npm test`, `npm run typecheck`, `npx eslint` on the changed files.
- [ ] **Step 9: Commit** — `feat(admin): read-only permits list and firms list/detail`.

---

## Controller checks after Task 11 (not executor steps)

These need a database or a browser, so the controller or the user runs them:

- `$env:NODE_OPTIONS='--experimental-require-module'; npm run build` is green.
- Spec verification, Stage 2: through `withStaffRo`, `UPDATE lsbd.person SET first_name = first_name WHERE false` and `SELECT 1 FROM lsbd.licensee_pii LIMIT 1` are refused with 42501.
- Spec verification, Stages 3–4: the unfiltered totals on `/admin/licensees`, `/admin/permits` and `/admin/firms` equal `SELECT count(*)` of `lsbd.person`, `lsbd.permits` and `lsbd.professional_llc`; five licensees and five permits are compared field by field against Access with Erin.
- Counts U1–U4 recorded; the oddity badge counts compared with 2,872 / 21 / 17.
- Print preview of a licensee detail page: no sidebar, header, banner or buttons; every section present; nothing clipped to one screen.
- Signed in as `staff`: no Discipline section. Signed in as `discipline` or `board`: no Contact section, office address only.
- `LSBD_STAFF_MODE` unset on Preview shows the banner; `live` hides it.

## Self-Review (run by the plan author)

- **Spec coverage.** Stage 2: data layer → Task 1 (per D1, not a second pool); G13 → verified, recorded above; server table → Task 4; banner → Task 2 (per D9, env var, no table); label maps → Task 3. Stage 3: list → Tasks 5, 10; detail sections → Tasks 6, 9, 10; discipline behind `discipline.read` → Task 9; "not linked" → Tasks 4, 6, 7, 9, 10; oddity badges → Tasks 3, 5, 10; print stylesheet → Tasks 2, 10. Stage 4: permits → Tasks 7, 11; firms and the PA empty state → Tasks 8, 11. Not covered on purpose: DOB (D5), `LSBD_RO_URL` (D1), `public.site_settings` (D9).
- **Type consistency.** `RoQueryFn`, `Paged`, `RawSearchParams`, `DetailCaps`, `Linked`, `PermitRow`, `FirmLink`, `LicenseeDetail` are each defined once (Tasks 1, 4, 6, 7, 8, 9) and consumed under the same name.
- **Review Focus.** Each of the five lines names the tasks whose tests pin it.
