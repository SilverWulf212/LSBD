# P2 Stage 0 — Close the Holes: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before more staff can sign in, make every admin action role-gated, take the public licence lookup off the Supabase anon key, define least-privilege database roles, and add CI.

**Architecture:** Authorization moves from "has a session" to a role → capability map checked in every server action, admin page and upload route. The public verify pages stop using PostgREST and query `public.public_licensee` through the server connection with parameterised SQL, which lets a later migration remove every `anon` grant. Database roles and the view change are written as hand-applied SQL files; nothing in this plan applies SQL to the live database outside a rolled-back test transaction.

**Tech Stack:** Next.js 16 (App Router, `src/proxy.ts`), next-auth 5 beta, Drizzle on node-postgres (`src/lib/db`), Supabase Postgres via the pooler, vitest (`tests/app` unit, `tests/it` live behind `LSBD_IT=1`).

**Spec:** `docs/superpowers/specs/2026-10-01-lsbd-p2-staged-plan.md` (Stage 0). Steps 1–2 of that stage are done: `scripts/apply-sql.ts` and `drizzle/0005_public_cms_lockdown.sql` (commit `902d89d`; the apply is the user's).

## Global Constraints

- Branch `feat/p2-admin-core`. One implementer at a time; every commit ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **No SQL is applied to the live database** by any task, except inside `BEGIN … ROLLBACK` in a `tests/it` test. Applying `drizzle/00NN_*.sql` is the user's step (`npx tsx scripts/apply-sql.ts <file>`). If a command is refused by the permission system, report it; do not find another route.
- Never print secrets or row values from `public.users`. Never use `rejectUnauthorized: false`.
- Modules under test use **relative imports only** (vitest has no `@/` alias) and take their query function by injection, following `src/lib/sync-status.ts:12` (`QueryFn`). Thin wrappers that import `@/lib/db` or `@/lib/auth` are not unit-tested.
- User input reaches SQL only as a bound parameter. No `sql.raw` and no string interpolation of input.
- `npm test`, `npx tsc --noEmit`, `npm run lint` and `npx next build` pass at the end of every task.
- Pause the `LSBD Sync*` scheduled tasks while `npm run test:it` runs, and resume them after (runbook §3).
- Roles are `admin, staff, discipline, finance, inspector, board` (`src/lib/auth-roles.ts`). Do not add or rename roles.

## Review Focus

1. **A new action or admin page added without a gate** → the structural test in Task 1 fails when any exported function in `src/actions/*.ts` or any `src/app/admin/**/page.tsx` lacks a capability check.
2. **Repeated or badly encoded query params** (`?q=a&q=b`, `/public/verify/%25E0`) → a validation message or 404, never a 500 (Task 4 tests).
3. **node-postgres returns `Date` objects where PostgREST returned ISO strings** → the public loader converts to ISO strings so `isExpired` and date formatting are unchanged (Task 4 test).
4. **A role with SELECT but no RLS policy sees zero rows and no error** → the verify script asserts a row floor, not just "no error" (Task 5).
5. **Crafted upload folder or blob URL** (`../`, another host, unknown folder) → rejected by `isAllowedBlobUrl` / `isAllowedFolder` (Task 2 tests).

---

### Task 1: Capability map and gate helpers

**Files:**
- Create: `src/lib/auth-capabilities.ts`
- Modify: `src/lib/auth-utils.ts`
- Test: `tests/app/auth-capabilities.test.ts`, `tests/app/admin-gates.test.ts`

**Interfaces:**
- Produces (`src/lib/auth-capabilities.ts`, relative import of `./auth-roles` only):
  - `export const CAPABILITIES = ["cms.read","cms.write","users.manage","sync.view","settings.manage","licensees.read","permits.read","discipline.read","pii.read"] as const`
  - `export type Capability = (typeof CAPABILITIES)[number]`
  - `export const ROLE_CAPABILITIES: Record<LsbdRole, readonly Capability[]>`
  - `export function can(role: LsbdRole | null | undefined, cap: Capability): boolean`
- Produces (`src/lib/auth-utils.ts`):
  - `export async function getSessionWith(cap: Capability): Promise<AuthedSession | null>` — null when there is no session or the role lacks `cap`.
  - `export async function requireCapability(cap: Capability): Promise<AuthedSession>` — redirects to `/admin/login` with no session, to `/admin/403` when the role lacks `cap`. `requireAuth` stays for existing callers until Task 2 removes its uses.

Role map (interim, until Erin answers the roles question):

| Role | Capabilities |
|---|---|
| admin | all nine |
| staff | cms.read, cms.write, licensees.read, permits.read, pii.read |
| discipline | cms.read, licensees.read, permits.read, discipline.read |
| finance | cms.read, licensees.read, permits.read |
| inspector | cms.read, licensees.read, permits.read |
| board | cms.read, licensees.read, permits.read |

- [ ] **Step 1: Write the failing unit test** `tests/app/auth-capabilities.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { CAPABILITIES, ROLE_CAPABILITIES, can } from "../../src/lib/auth-capabilities";
import { LSBD_ROLES } from "../../src/lib/auth-roles";

describe("capabilities", () => {
  it("covers every role", () => {
    expect(Object.keys(ROLE_CAPABILITIES).sort()).toEqual([...LSBD_ROLES].sort());
  });
  it("admin has every capability", () => {
    for (const c of CAPABILITIES) expect(can("admin", c)).toBe(true);
  });
  it("only admin and staff may write CMS content", () => {
    expect(LSBD_ROLES.filter((r) => can(r, "cms.write"))).toEqual(["admin", "staff"]);
  });
  it("only admin manages users, sync and settings", () => {
    for (const c of ["users.manage", "sync.view", "settings.manage"] as const)
      expect(LSBD_ROLES.filter((r) => can(r, c))).toEqual(["admin"]);
  });
  it("pii.read is admin and staff; discipline.read is admin and discipline", () => {
    expect(LSBD_ROLES.filter((r) => can(r, "pii.read"))).toEqual(["admin", "staff"]);
    expect(LSBD_ROLES.filter((r) => can(r, "discipline.read"))).toEqual(["admin", "discipline"]);
  });
  it("denies a missing or unknown role", () => {
    expect(can(null, "cms.read")).toBe(false);
    expect(can(undefined, "cms.read")).toBe(false);
    expect(can("nope" as never, "cms.read")).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing structural test** `tests/app/admin-gates.test.ts`

Reads source text with `node:fs`; no imports from `src`.
  - For every `src/actions/*.ts`: split on `export async function <name>(`; each function's text up to the next `export async function` (or end of file) must contain `requireCapability(` or `getSessionWith(`. Collect offenders as `file:name` and `expect(offenders).toEqual([])`.
  - No file under `src/actions` contains `async function requireSession`.
  - For every `page.tsx` under `src/app/admin` except `login/page.tsx` and `403/page.tsx`: the text contains `requireCapability(`.
  - `src/app/api/upload/route.ts` contains `getSessionWith(`.

- [ ] **Step 3: Run both** — `npx vitest run tests/app/auth-capabilities.test.ts tests/app/admin-gates.test.ts`. Expected: the first fails on a missing module; the second fails listing every action and page.
- [ ] **Step 4: Implement `auth-capabilities.ts` and the two helpers in `auth-utils.ts`.** `can` uses `ROLE_CAPABILITIES[role]?.includes(cap) ?? false`.
- [ ] **Step 5: Run** — `auth-capabilities.test.ts` passes; `admin-gates.test.ts` still fails (Task 2 turns it green). Mark the gates test `describe.skip` with the comment `// enabled in Task 2` so the suite is green at this commit.
- [ ] **Step 6: Commit** — `feat(auth): role capability map and requireCapability`

### Task 2: Gate every action, admin page, upload path and the sidebar

**Files:**
- Modify: all of `src/actions/*.ts` (alerts, board-members, dashboard, fees, forms, meetings, pages, posts, publications, staff, upload, users); every `page.tsx` under `src/app/admin` except `login` and `403`; `src/app/api/upload/route.ts`; `src/components/admin/admin-sidebar.tsx`; `src/app/admin/layout.tsx`
- Create: `src/lib/blob-rules.ts`
- Test: `tests/app/admin-gates.test.ts` (un-skip), `tests/app/blob-rules.test.ts`

**Interfaces:**
- Consumes: `requireCapability`, `getSessionWith`, `can`, `Capability` from Task 1.
- Produces (`src/lib/blob-rules.ts`, no imports):
  - `export const UPLOAD_FOLDERS: readonly string[]` — exactly the folder names passed today by callers of `uploadFile` / `uploadFileAction` / `/api/upload` (find them with a search for `folder`), plus `"documents"` (the default in `src/actions/upload.ts:11`).
  - `export function isAllowedFolder(folder: string): boolean`
  - `export function isAllowedBlobUrl(url: string): boolean` — true only when the URL parses, the protocol is `https:`, the hostname ends with `.public.blob.vercel-storage.com`, and the first path segment is in `UPLOAD_FOLDERS`.

Capability per call site:

| Where | Capability |
|---|---|
| Every `get*` read in the CMS action files and `dashboard.ts`; every CMS list/edit page; `/admin` dashboard | `cms.read` |
| Every create/update/delete in the CMS action files; `uploadFileAction`; `deleteFileAction`; `POST /api/upload` | `cms.write` |
| `src/actions/users.ts` (all five) and `/admin/users/*` pages (replaces `requireAuth("admin")`) | `users.manage` |
| `/admin/sync` page (replaces `requireAuth("admin")`) | `sync.view` |

- [ ] **Step 1: Write the failing test** `tests/app/blob-rules.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { UPLOAD_FOLDERS, isAllowedBlobUrl, isAllowedFolder } from "../../src/lib/blob-rules";

const host = "https://abc123.public.blob.vercel-storage.com";
describe("blob rules", () => {
  it("accepts a known folder on the blob host", () => {
    expect(isAllowedBlobUrl(`${host}/${UPLOAD_FOLDERS[0]}/file.pdf`)).toBe(true);
  });
  it("rejects other hosts, http, unknown folders, traversal and junk", () => {
    expect(isAllowedBlobUrl(`https://evil.example/${UPLOAD_FOLDERS[0]}/x.pdf`)).toBe(false);
    expect(isAllowedBlobUrl(`http://abc123.public.blob.vercel-storage.com/${UPLOAD_FOLDERS[0]}/x.pdf`)).toBe(false);
    expect(isAllowedBlobUrl(`${host}/secret/x.pdf`)).toBe(false);
    expect(isAllowedBlobUrl(`${host}/../${UPLOAD_FOLDERS[0]}/x.pdf`)).toBe(false);
    expect(isAllowedBlobUrl("not a url")).toBe(false);
  });
  it("folder allow-list", () => {
    expect(isAllowedFolder("documents")).toBe(true);
    expect(isAllowedFolder("../documents")).toBe(false);
    expect(isAllowedFolder("")).toBe(false);
  });
});
```

- [ ] **Step 2: Un-skip `tests/app/admin-gates.test.ts`; run both.** Expected: both fail.
- [ ] **Step 3: Implement `blob-rules.ts`.**
- [ ] **Step 4: Gate the actions.** Delete every private `requireSession`. The gate is the first statement of each exported function, outside any `try`. Reads keep their existing `try { … } catch { return [] }` around the query only. `uploadFileAction` rejects a folder that fails `isAllowedFolder`; `deleteFileAction` rejects a URL that fails `isAllowedBlobUrl` (throw `Error("Invalid file")`). `POST /api/upload` returns 401 JSON when `getSessionWith("cms.write")` is null and 400 for a bad folder.
- [ ] **Step 5: Gate the pages.** `await requireCapability(…)` is the first statement of each page component.
- [ ] **Step 6: Sidebar.** Replace `adminOnly?: boolean` with `capability: Capability` on each item in `sidebarItems`; the component takes the user's role as a prop (passed from `src/app/admin/layout.tsx`, which already calls `auth()`) and filters with `can(role, item.capability)`.
- [ ] **Step 7: Run** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npx next build`. Expected: all pass; `requireAuth` has no remaining callers — remove it.
- [ ] **Step 8: Commit** — `fix(security): capability checks on every admin action, page and upload path`

### Task 3: Site search returns published posts only

**Files:**
- Create: `src/lib/sql-like.ts`
- Modify: `src/app/api/search/route.ts`
- Test: `tests/app/sql-like.test.ts`

**Interfaces:**
- Produces: `export function escapeLike(input: string): string` — escapes `\`, `%` and `_` with a backslash (Postgres default LIKE escape). Used again in Task 4.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { escapeLike } from "../../src/lib/sql-like";

describe("escapeLike", () => {
  it("escapes LIKE metacharacters and the escape character", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
    expect(escapeLike("smith")).toBe("smith");
    expect(escapeLike("")).toBe("");
  });
});
describe("/api/search", () => {
  const src = readFileSync("src/app/api/search/route.ts", "utf8");
  it("filters posts to published and escapes the term", () => {
    expect(src).toContain('eq(posts.status, "published")');
    expect(src).toContain("escapeLike(");
  });
});
```

- [ ] **Step 2: Run** — fails (module missing).
- [ ] **Step 3: Implement.** In the route: `const searchTerm = \`%${escapeLike(query)}%\``; the posts query becomes `and(eq(posts.status, "published"), or(ilike(title), ilike(content)))`; cap `query` at 100 characters.
- [ ] **Step 4: Run** `npm test` — passes.
- [ ] **Step 5: Commit** — `fix(security): site search no longer returns draft posts`

### Task 4: Public verify off the anon key, with input hardening

**Files:**
- Create: `src/lib/public-verify-query.ts`, `src/lib/client-ip.ts`
- Modify: `src/lib/public-verify-helpers.ts`, `src/lib/public-verify.ts`, `src/app/(public)/public/verify/page.tsx`, `src/app/(public)/public/verify/[license_id]/page.tsx`, `next.config.ts`, `tests/app/public-verify.test.ts`, `tests/app/lazy-clients.test.ts`
- Delete: `src/lib/supabase-anon.ts`
- Test: `tests/app/public-verify-query.test.ts`, `tests/app/public-verify.test.ts`

**Interfaces:**
- Consumes: `escapeLike` (Task 3).
- Produces (`public-verify-helpers.ts`):
  - `export function firstParam(v: string | string[] | null | undefined): string` — first element of an array, else the string, trimmed, `""` for null.
  - `resolveSearchInput` accepts `string | string[] | undefined` for every field and uses `firstParam`.
  - `export const PAGE_SIZE = 15`, `export const MAX_RESULTS = 50`, `export const LAST_PAGE = 4` (`ceil(50 / 15)`); `resolveSearchInput` clamps `page` to `1..LAST_PAGE`.
  - `export function isValidLicenseId(s: string): boolean` — `/^[A-Za-z0-9-]{1,20}$/`.
- Produces (`public-verify-query.ts`, relative imports only):
  - `export type PgQueryFn = (text: string, params: readonly unknown[]) => Promise<readonly Record<string, unknown>[]>`
  - `export async function searchPublicLicensees(query: PgQueryFn, p: SearchParams): Promise<SearchResult>`
  - `export async function getPublicLicensees(query: PgQueryFn, licenseId: string, type?: LicenseType | null): Promise<PublicLicensee[]>`
  - `SearchParams` and `SearchResult` move here unchanged from `public-verify.ts`.
- Produces (`client-ip.ts`): `export function clientIp(h: { get(name: string): string | null }): string` — first `x-forwarded-for` entry, then `x-real-ip`, else `"unknown"`.
- `src/lib/public-verify.ts` becomes the thin wrapper: it binds `PgQueryFn` to `db.$client.query(text, [...params])` (`.rows`) and re-exports the helpers, so page imports are unchanged.

Query rules:
- Target `public.public_licensee`; select the 12 columns of `PUBLIC_LICENSEE_COLUMNS` by name.
- Search: `license_id = $n`; `last_name ILIKE $n` with the parameter `escapeLike(last) + "%"`; same for `first_name`; `type = $n` unless `"all"`. Order as today (`type` first for a number search, then `last_name`, `first_name`, `date_since`, NULLs last). `LIMIT 15 OFFSET (page-1)*15` with `page` already clamped. Total comes from `count(*) OVER()` on the same statement, capped at `MAX_RESULTS`; `hasMore` is `total > MAX_RESULTS`.
- Detail: `license_id = $1`, optional `type = $2`, `ORDER BY type, date_since NULLS LAST LIMIT 25`.
- `date_since` / `date_until` arrive as `Date`; convert with `toISOString()` (null stays null) so `PublicLicensee` keeps string dates.

- [ ] **Step 1: Write the failing tests** `tests/app/public-verify-query.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { getPublicLicensees, searchPublicLicensees, type PgQueryFn } from "../../src/lib/public-verify-query";

function fake(rows: Record<string, unknown>[] = []) {
  const calls: { text: string; params: readonly unknown[] }[] = [];
  const query: PgQueryFn = async (text, params) => { calls.push({ text, params }); return rows; };
  return { query, calls };
}
const row = {
  license_id: "2227", type: "D", status: "ACT", action: null,
  date_since: new Date("2001-07-01T05:00:00Z"), date_until: new Date("2027-01-01T05:59:59Z"),
  first_name: "A", middle_name: null, last_name: "SMITH", license_name: null, suffix: null, prefix: null,
  total: "61",
};

describe("searchPublicLicensees", () => {
  it("binds input as parameters and escapes LIKE wildcards", async () => {
    const f = fake([row]);
    await searchPublicLicensees(f.query, { lastName: "%%", firstName: "a_b", type: "all", page: 1 });
    const { text, params } = f.calls[0];
    expect(text).toContain("public.public_licensee");
    expect(text).not.toContain("%%");
    expect(text).not.toContain("a_b");
    expect(params).toContain("\\%\\%%");
    expect(params).toContain("a\\_b%");
    expect(text).toMatch(/LIMIT 15/);
  });
  it("converts dates to ISO strings and caps the total", async () => {
    const f = fake([row]);
    const r = await searchPublicLicensees(f.query, { lastName: "smith", type: "all", page: 1 });
    expect(r.rows[0].date_until).toBe("2027-01-01T05:59:59.000Z");
    expect(r.rows[0]).not.toHaveProperty("total");
    expect(r.total).toBe(50);
    expect(r.hasMore).toBe(true);
    expect(r.pageSize).toBe(15);
  });
  it("returns an empty result with total 0", async () => {
    const r = await searchPublicLicensees(fake([]).query, { licenseId: "999999", type: "all", page: 1 });
    expect(r).toMatchObject({ rows: [], total: 0, hasMore: false });
  });
  it("adds the type filter only for D/H/E", async () => {
    const f = fake([]);
    await searchPublicLicensees(f.query, { licenseId: "2227", type: "H", page: 2 });
    expect(f.calls[0].params).toEqual(expect.arrayContaining(["2227", "H"]));
    expect(f.calls[0].text).toMatch(/OFFSET/);
  });
});

describe("getPublicLicensees", () => {
  it("looks up by number, optional type, limit 25, sorted D,H,E", async () => {
    const f = fake([{ ...row, type: "H" }, row]);
    const rows = await getPublicLicensees(f.query, "2227", null);
    expect(f.calls[0].params).toEqual(["2227"]);
    expect(f.calls[0].text).toMatch(/LIMIT 25/);
    expect(rows.map((r) => r.type)).toEqual(["D", "H"]);
  });
});
```

Add to `tests/app/public-verify.test.ts`:

```ts
it("resolveSearchInput takes the first of repeated params and clamps the page", () => {
  const r = resolveSearchInput({ q: ["smith", "jones"], page: "999", type: ["h", "d"] });
  expect(r.lastName).toBe("smith");
  expect(r.page).toBe(4);
  expect(r.type).toBe("H");
});
it("isValidLicenseId", () => {
  expect(isValidLicenseId("2227")).toBe(true);
  expect(isValidLicenseId("unknown-12345")).toBe(true);
  expect(isValidLicenseId("%E0")).toBe(false);
  expect(isValidLicenseId("")).toBe(false);
  expect(isValidLicenseId("a".repeat(21))).toBe(false);
});
```

- [ ] **Step 2: Run** — fail (missing module and exports).
- [ ] **Step 3: Implement the helpers, `public-verify-query.ts`, `client-ip.ts`, and the thin `public-verify.ts`.**
- [ ] **Step 4: Update the pages.**
  - Search page: `searchParams` typed `Record<string, string | string[] | undefined>`; use `clientIp`; on a query error log with `console.error` and show `"Search is temporarily unavailable. Please try again."`.
  - Detail page: remove both `decodeURIComponent` calls (Next has already decoded the param); `notFound()` when `!isValidLicenseId(license_id)`; rate limit `rateLimit(\`verify-detail:${ip}\`, 60, 60_000)` and render the same rate-limit notice the search page uses; same generic error text.
- [ ] **Step 5: `next.config.ts`.** Change the CDN rule's source to `/((?!admin|api|_next|public/verify).*)` and add a rule for `/public/verify/:path*` and one for `/public/verify` with `Cache-Control: private, no-store`.
- [ ] **Step 6: Remove `src/lib/supabase-anon.ts`** and its cases in `tests/app/lazy-clients.test.ts`. Keep `@supabase/supabase-js` in `package.json` (scripts use it).
- [ ] **Step 7: Run** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npx next build`. Then `npx next start` (or `next dev`) and request: `/public/verify?last_name=smith` (results), `/public/verify?last_name=%25%25` (no rows), `/public/verify?q=a&q=b` (200), `/public/verify/%25E0` (404), `/public/verify/2227` (200, D/H/E groups). None returns 500.
- [ ] **Step 8: Commit** — `fix(security): public verify uses the server connection with bound parameters; input hardening`

### Task 5: Database roles, owner-rights view, and a verify script that can fail

**Files:**
- Create: `drizzle/0006_db_roles.sql`, `drizzle/0007_public_view_owner_rights.sql`, `tests/it/grants.test.ts`, `docs/RUNBOOK-DB-ROLES.md`
- Rewrite: `scripts/verify-rls.ts`

**Interfaces:**
- Consumes: `connectPg` (`scripts/lib/pg.ts`), `loadSecrets` (`scripts/lib/secrets.ts`).
- Produces: role names `lsbd_app`, `lsbd_staff_ro` (Stage 2 connects with them); view column `legacy_key` appended to `public.public_licensee` (Stage 5 uses it).

`0006_db_roles.sql` — additive, safe to apply at any time, idempotent:
- Create `lsbd_app` and `lsbd_staff_ro` with `NOLOGIN` if absent (passwords and `LOGIN` are set by the user out of band — never in a file). `ALTER ROLE … SET statement_timeout = '30s'` on both. `GRANT lsbd_app, lsbd_staff_ro TO postgres` (so the verify script can `SET ROLE`).
- `lsbd_app`: `USAGE` on schema `public`; `SELECT, INSERT, UPDATE, DELETE` on every table in `public` and `USAGE, SELECT` on its sequences, **except** `audit_log`, which gets `SELECT, INSERT` only; a policy `lsbd_app_all` (`FOR ALL TO lsbd_app USING (true) WITH CHECK (true)`) on every `public` table (RLS is on after 0005); `SELECT` on `public.public_licensee`; `USAGE` on schema `lsbd_raw` plus `SELECT` and a `FOR SELECT … USING (true)` policy on `lsbd_raw._sync_runs` and `lsbd_raw._sync_tables`.
- `lsbd_staff_ro`: `USAGE` on schema `lsbd`; `SELECT` and a policy `staff_ro_select` (`FOR SELECT TO lsbd_staff_ro USING (true)`) on an **explicit list** of tables, written out by name. Take SQL table names from `src/lib/db/lsbd/*.ts` for these Drizzle tables: `person, license, personAddress, personEducation, personMeta, individual, individualStatus, professional, individualAffiliation, office, officeAffiliation, permits, permitType, sedLevel, professionalLlc, professionalAssociation, disciplinary, education`, and the geography/code lookups (`parishes, cities, zipcodes, electionDistricts, tblSpecialties` and the status/type/class lookup tables). **Never** in the list: `licensee_pii`, `users`, `logins`, `person_practice_stats`, any transaction, renewal, complaint or `vs_*` table, any `_src_*` view or `_transform_*` table. No `ALTER DEFAULT PRIVILEGES`.

`0007_public_view_owner_rights.sql` — **apply only after Task 4 is deployed** (it removes the anon path the old code uses):
- `CREATE OR REPLACE VIEW public.public_licensee WITH (security_invoker = false, security_barrier = true) AS` the existing select from `drizzle/0002_rls.sql:70-86` with `l.legacy_key` appended as the last column.
- `REVOKE ALL ON public.public_licensee FROM anon, authenticated`; drop policies `anon_active_license` and `anon_person_for_active_license`; `REVOKE ALL ON ALL TABLES IN SCHEMA lsbd FROM anon` (clears the column grants); `REVOKE USAGE ON SCHEMA lsbd FROM anon`.
- First statement: a `DO` block that raises unless the view's owner has `rolbypassrls` or owns both base tables (otherwise the view would return zero rows).

- [ ] **Step 1: Write the failing live test** `tests/it/grants.test.ts` (`describe.skipIf(process.env.LSBD_IT !== "1")`). In one connection: `BEGIN`; run the text of 0005, 0006 and 0007 with `c.query(readFileSync(file, "utf8"))` inside the test's own transaction (do not call `applySqlFile`, which commits); assert; `ROLLBACK` in `afterAll`. Assertions:
  - `SET LOCAL ROLE lsbd_staff_ro`: `SELECT count(*) FROM lsbd.license` ≥ 19000; `SELECT 1 FROM lsbd.licensee_pii` raises permission denied; `UPDATE lsbd.person SET first_name = first_name WHERE false` raises permission denied; `SELECT 1 FROM public.users` raises permission denied.
  - `SET LOCAL ROLE lsbd_app`: `SELECT count(*) FROM public.public_licensee` ≥ 13000 and the result has a `legacy_key` column; `SELECT count(*) FROM public.users` ≥ 1; `SELECT count(*) FROM lsbd_raw._sync_runs` ≥ 1; `DELETE FROM public.audit_log WHERE false` raises permission denied; `SELECT 1 FROM lsbd.license` raises permission denied.
  - `SET LOCAL ROLE anon`: `SELECT 1 FROM public.users`, `FROM public.public_licensee` and `FROM lsbd.license` each raise permission denied.
  - As the session role: every table in schemas `lsbd` and `public` has `relrowsecurity = true` (list offenders).
  Wrap each expected failure in a `SAVEPOINT` / `ROLLBACK TO` so the transaction survives.
- [ ] **Step 2: Run** `$env:LSBD_IT='1'; npx vitest run tests/it/grants.test.ts` with the sync tasks paused. Expected: fails (files missing). If the permission system refuses the run, stop and report; do not retry another way.
- [ ] **Step 3: Write `0006` and `0007`.**
- [ ] **Step 4: Run the test** — passes; confirm afterwards that nothing persisted: `SELECT 1 FROM pg_roles WHERE rolname = 'lsbd_app'` returns no row (unless the user has already applied 0006).
- [ ] **Step 5: Rewrite `scripts/verify-rls.ts`** as the post-apply check, exit code 1 on any failed check, printing counts only:
  - anon REST (`@supabase/supabase-js`): `users`, `audit_log`, `posts`, `public_licensee` each return an error **or** zero rows with no column data; any row is a failure.
  - `SUPABASE_DB_URL_SESSION` + `SET ROLE`: the same role assertions as the test (read-only statements only; the `UPDATE … WHERE false` check is run inside `BEGIN … ROLLBACK`).
  - Flag `--stage=0005|0006|0007` selects which checks apply, so it is usable after each file.
- [ ] **Step 6: Write `docs/RUNBOOK-DB-ROLES.md`:** the apply order (0005 any time; 0006 any time; Task 4 deployed to every environment that uses verify; then 0007), the verify command after each, how to give the two roles `LOGIN` and a password and build the pooler URLs (`<role>.<projectref>` user), which Vercel variables to set (`POSTGRES_URL` → `lsbd_app`, `LSBD_RO_URL` → `lsbd_staff_ro`, Preview first), and the rule that a future CMS table needs an explicit grant and policy for `lsbd_app`.
- [ ] **Step 7: Run** `npm test`, `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 8: Commit** — `feat(db): least-privilege roles, owner-rights public view, failing-capable RLS check (not yet applied)`

### Task 6: CI and dependency criticals

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Add** `"typecheck": "tsc --noEmit"` to `package.json` scripts.
- [ ] **Step 2: Write `ci.yml`:** triggers `push` and `pull_request`; one job on `windows-latest` (three sync tests shell out to PowerShell); Node 20 with npm cache; `npm ci`; `npm run typecheck`; `npm run lint`; `npm test`. No secrets, no `test:it`.
- [ ] **Step 3: Run the same four commands locally.** Expected: all pass. If `npm run lint` has pre-existing failures, fix only those in files this plan touched and report the rest.
- [ ] **Step 4: `npm audit --omit=dev`.** Apply `npm audit fix` (never `--force`). For any remaining critical or high advisory, record package, path and why it could not be fixed without a major upgrade in the task report. Re-run `npm test` and `npx next build`.
- [ ] **Step 5: Commit** — `chore(ci): typecheck, lint and unit tests on every push; non-breaking audit fixes`

---

## After the tasks (controller)

- Final whole-branch review of `feat/p2-admin-core` against this plan and the spec.
- Hand the user the ordered apply list from `docs/RUNBOOK-DB-ROLES.md`.
- Update the SDD ledger, `HANDOFF.md`, CLAUDE.md and the Outline progress log.
