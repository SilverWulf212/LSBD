# LSBD Security Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the code-level findings of the 2026-10-02 security audit (H1, M2, M3, L1–L4, L6–L8) on branch `fix/security-audit`, ready for a Preview test.

**Architecture:** Each fix is a small pure module with unit tests, wired into one existing call site: a Postgres-backed failed-login limiter and a periodic session re-check behind `src/lib/auth.ts`, an HTML sanitizer in front of post storage and rendering, content-sniffing upload rules, and stricter headers built by a testable helper. No new external service.

**Tech Stack:** Next.js 16 (App Router, `src/app`), next-auth v5 (credentials, JWT sessions), Drizzle over node-postgres, zod, vitest (node environment, relative imports from `tests/app`), `sanitize-html` (new).

**Spec:** `docs/superpowers/specs/2026-10-02-lsbd-security-audit-findings.md`

## Global Constraints

- Work only on branch `fix/security-audit`. Do not push to `main`, do not deploy, do not change Vercel settings.
- **Do not apply any SQL to any database** and do not run scripts that connect to one. `drizzle/0008_login_attempts.sql` is written and reviewed only; the user applies it.
- Tests are unit tests under `tests/app/`, run with `npm test`. They must not need a database or network. Import source with relative paths (`../../src/lib/...`), as the existing tests do.
- After each task: `npm test`, `npm run typecheck`, and `npx eslint <changed files>` are clean (existing warnings in untouched files are not yours).
- Never write `rejectUnauthorized: false`. Database connections in `scripts/` go through `scripts/lib/pg.ts`.
- Exact values from the spec: login window **15 minutes**, **10** failures per IP, **5** per email; session `maxAge` **8 hours**; session re-check every **5 minutes**; search limit **30 per minute per IP**; upload extensions `pdf`, `jpg`, `jpeg`, `png`, `webp`; seed password minimum **14** characters.
- Match the surrounding code's style and comment density. No new dependency except `sanitize-html` and `@types/sanitize-html`.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- Host shell is Windows PowerShell 5.1 (no `&&`); Git Bash is also available.

## Review Focus

1. **The limiter's own store fails** (table missing, database down): sign-in must be refused, not allowed. Test in Task 1.
2. **Email variants** (`Erin@LSBD.org `, `erin@lsbd.org`) must share one failure bucket, and an unknown email must cost the same bcrypt work as a known one. Tests in Task 1.
3. **Database error during the session re-check** must keep the existing session, not sign everyone out. Test in Task 2.
4. **Disguised script in post HTML** (`<img src=x onerror=…>`, `<a href="JaVaScRiPt:…">`, `<svg onload>`), while tables, images, headings and text alignment written by the editor survive unchanged. Tests in Task 3.
5. **A file whose name and declared type say PDF but whose bytes are HTML**, and an honest file with an upper-case extension (`REPORT.PDF`). Tests in Task 4.

---

### Task 1: Failed-login limiter and constant-time sign-in (H1)

**Files:**
- Create: `drizzle/0008_login_attempts.sql`
- Create: `src/lib/login-limiter.ts` (pure logic, no imports from `@/lib/db`)
- Create: `src/lib/login-attempts-store.ts` (the Postgres `AttemptStore`)
- Modify: `src/lib/auth.ts` (`authorize`)
- Test: `tests/app/login-limiter.test.ts`

**Interfaces:**
- Consumes: `clientIp(headers)` from `src/lib/client-ip.ts`; `db`, `users` from `src/lib/db`.
- Produces (from `src/lib/login-limiter.ts`):
  - `LOGIN_LIMITS = { windowMs: 15 * 60_000, perIp: 10, perEmail: 5 } as const`
  - `interface AttemptStore { countSince(key: string, since: Date): Promise<number>; record(key: string): Promise<void>; clear(key: string): Promise<void> }`
  - `loginKeys(ip: string, email: string): { ip: string; email: string }` → `ip:<ip>` and `email:<trimmed, lower-cased email>`
  - `interface LoginUser { id: number; email: string; name: string; role: string; passwordHash: string }`
  - `interface LoginDeps { store: AttemptStore; findUser(email: string): Promise<LoginUser | undefined>; compare(password: string, hash: string): Promise<boolean>; now?: () => Date }`
  - `verifyCredentials(input: { email: unknown; password: unknown; ip: string }, deps: LoginDeps): Promise<{ id: string; email: string; name: string; role: string } | null>`
  - `DUMMY_BCRYPT_HASH: string` (a valid cost-10 bcrypt hash of a random string, generated once and pasted in)

- [ ] **Step 1: Write the failing tests** in `tests/app/login-limiter.test.ts`, using an in-memory `AttemptStore` fake (a `Map<string, Date[]>`) and a `compare` fake that records the hashes it was called with:

  - `loginKeys("1.2.3.4", " Erin@LSBD.org ")` equals `{ ip: "ip:1.2.3.4", email: "email:erin@lsbd.org" }`.
  - correct password → returns `{ id: "6", email, name, role }` (id as a string) and clears the email key.
  - wrong password → `null`, and one failure recorded under both keys.
  - unknown email → `null`, `compare` was called exactly once with `DUMMY_BCRYPT_HASH`, and a failure is recorded under both keys.
  - after 5 recorded failures for the email inside the window, the correct password returns `null` and `compare` is **not** called.
  - after 10 recorded failures for the IP (different emails), any sign-in from that IP returns `null`.
  - failures older than 15 minutes (drive `now`) do not count.
  - `store.countSince` rejects → `null`, `compare` not called (fail closed).
  - `store.record` rejects on a wrong password → still `null` (does not throw).
  - email not a string, email longer than 255, password longer than 200, empty password → `null` without calling `findUser`.

- [ ] **Step 2: Run** `npx vitest run tests/app/login-limiter.test.ts` — expected: fails, module not found.

- [ ] **Step 3: Implement `src/lib/login-limiter.ts`.** Order inside `verifyCredentials`: validate input with zod → both `countSince` checks (either at or over its limit → `null`) → `findUser(normalised email)` → `compare(password, user?.passwordHash ?? DUMMY_BCRYPT_HASH)` → on failure `record` both keys, on success `clear` the email key. Wrap the limit check in try/catch returning `null`; wrap `record`/`clear` so their errors are swallowed. `findUser` receives the trimmed, lower-cased email.

- [ ] **Step 4: Run the test file** — expected: all pass.

- [ ] **Step 5: Write `drizzle/0008_login_attempts.sql`** in the style of `drizzle/0005_public_cms_lockdown.sql` (header comment: why, what, idempotent, applied with `npx tsx scripts/apply-sql.ts`, no `BEGIN`/`COMMIT`):

  ```sql
  CREATE TABLE IF NOT EXISTS public.login_attempts (
    id bigserial PRIMARY KEY,
    key text NOT NULL,
    attempted_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS login_attempts_key_time ON public.login_attempts (key, attempted_at);
  ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.login_attempts FROM anon, authenticated;
  REVOKE ALL ON SEQUENCE public.login_attempts_id_seq FROM anon, authenticated;
  ```

- [ ] **Step 6: Implement `src/lib/login-attempts-store.ts`**: `export const pgAttemptStore: AttemptStore`, using `db.execute(sql\`…\`)` with bound parameters against `public.login_attempts`. `record` also deletes rows older than 24 hours for that key. Do not add the table to `src/lib/db/schema.ts` (drizzle-kit would then try to manage a hand-written migration).

- [ ] **Step 7: Wire `src/lib/auth.ts`**: `authorize(credentials, request)` returns `verifyCredentials({ email: credentials?.email, password: credentials?.password, ip: clientIp(request.headers) }, { store: pgAttemptStore, findUser, compare })`, where `findUser` is the existing `users` query by email, selecting `id, email, name, role, passwordHash`.

- [ ] **Step 8: Run** `npm test`, `npm run typecheck`, `npx eslint src/lib/auth.ts src/lib/login-limiter.ts src/lib/login-attempts-store.ts tests/app/login-limiter.test.ts` — expected: clean.

- [ ] **Step 9: Commit** — `fix(security): limit failed admin sign-ins; same work for unknown emails`

### Task 2: Session lifetime and periodic re-check (M3)

**Files:**
- Create: `src/lib/session-refresh.ts`
- Modify: `src/lib/auth.ts` (`session`, `callbacks.jwt`), and the next-auth type augmentation that declares `token.id` / `token.role` (find it with `grep -rn "declare module \"next-auth" src`) to add `checkedAt?: number`
- Test: `tests/app/session-refresh.test.ts`

**Interfaces:**
- Consumes: `auth.ts` as left by Task 1.
- Produces (from `src/lib/session-refresh.ts`):
  - `SESSION_MAX_AGE_SECONDS = 8 * 60 * 60`, `SESSION_RECHECK_MS = 5 * 60_000`
  - `interface SessionToken { id?: string; role?: string; iat?: number; checkedAt?: number; [k: string]: unknown }`
  - `type UserLookup = (id: number) => Promise<{ role: string; updatedAt: Date } | undefined>`
  - `refreshSessionToken<T extends SessionToken>(token: T, lookup: UserLookup, now: number): Promise<T | null>`

- [ ] **Step 1: Write the failing tests** in `tests/app/session-refresh.test.ts`:

  - `checkedAt` 4 minutes ago → same token returned, `lookup` not called.
  - `checkedAt` 6 minutes ago, user found with a different role and `updatedAt` before `iat` → token returned with the new role and `checkedAt === now`.
  - no `checkedAt` at all (a token issued before this change) → treated as due: `lookup` is called.
  - user not found → `null`.
  - `updatedAt` later than `iat * 1000` → `null`.
  - `lookup` rejects → the original token is returned unchanged (same role, same `checkedAt`), nothing thrown.
  - `token.id` missing or not a positive integer string → `null` without calling `lookup`.

- [ ] **Step 2: Run** `npx vitest run tests/app/session-refresh.test.ts` — expected: fails, module not found.

- [ ] **Step 3: Implement `refreshSessionToken`** to satisfy those tests.

- [ ] **Step 4: Wire `auth.ts`**: `session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS }`; in `jwt`, when `user` is present set `id`, `role` and `checkedAt = Date.now()`; otherwise `return refreshSessionToken(token, lookup, Date.now())`, with `lookup` selecting `role, updatedAt` from `users` by id.

- [ ] **Step 5: Run** `npm test`, `npm run typecheck`, eslint on the changed files — expected: clean.

- [ ] **Step 6: Commit** — `fix(security): 8-hour sessions, re-checked against the user every 5 minutes`

### Task 3: Sanitize post HTML on write and render (M2)

**Files:**
- Create: `src/lib/sanitize-post-html.ts`
- Modify: `src/actions/posts.ts` (create and update paths), `src/components/content/post-content.tsx`, `package.json` / `package-lock.json`
- Test: `tests/app/sanitize-post-html.test.ts`

**Interfaces:**
- Produces: `sanitizePostHtml(html: string): string`

- [ ] **Step 1: Install** `npm install sanitize-html` and `npm install -D @types/sanitize-html`.

- [ ] **Step 2: Write the failing tests** in `tests/app/sanitize-post-html.test.ts`:

  - `<p>Hi</p><script>alert(1)</script>` → contains `<p>Hi</p>`, no `script`.
  - `<img src="x" onerror="alert(1)">` → no `onerror`.
  - `<a href="JaVaScRiPt:alert(1)">x</a>` and `<a href="data:text/html,…">x</a>` → no `href` left.
  - `<svg onload="alert(1)"></svg>`, `<iframe src="https://evil.example"></iframe>`, `<style>…</style>`, `<form action="…">` → removed.
  - kept unchanged: `<h2>`, `<strong>`, `<em>`, `<u>`, `<s>`, `<blockquote>`, `<ul><li>`, `<ol><li>`, `<hr>`, `<br>`, `<table><tbody><tr><th colspan="2">…<td rowspan="2">`.
  - `<p style="text-align: center">x</p>` keeps the style; `<p style="position:fixed;background:url(javascript:1)">` loses it.
  - `<a href="https://example.gov/a" target="_blank">` keeps `href` and `target`, and has `rel` containing `noopener`.
  - `<a href="/resources/fees">`, `<a href="mailto:info@lsbd.org">` keep `href`.
  - `<img src="https://abc.public.blob.vercel-storage.com/images/a.png" alt="A">` keeps `src` and `alt`; `<img src="http://example.com/a.png">` loses `src`.
  - sanitizing already-sanitized output returns it unchanged (idempotent), for the "kept" sample.

- [ ] **Step 3: Run** the test file — expected: fails, module not found.

- [ ] **Step 4: Implement `sanitizePostHtml`** with `sanitize-html`: explicit `allowedTags`, `allowedAttributes`, `allowedStyles` (only `text-align` with `left|right|center|justify`), `allowedSchemes: ["https", "mailto"]`, relative URLs allowed, and a `transformTags` rule adding `rel="noopener noreferrer"` to links with `target`. Before writing the allow-list, read the Tiptap extensions the editor enables (`grep -rn "@tiptap" src/components`) and allow exactly the tags and attributes those produce.

- [ ] **Step 5: Use it.** In `src/actions/posts.ts`, store `sanitizePostHtml(validated.content)` in both create and update. In `post-content.tsx`, render `sanitizePostHtml(html)`.

- [ ] **Step 6: Run** `npm test`, `npm run typecheck`, eslint on the changed files, and `npm run build` (the sanitizer runs in a server component; the build proves it bundles) — expected: clean.

- [ ] **Step 7: Commit** — `fix(security): sanitize news post HTML on write and on render`

### Task 4: Upload type from content, and validated blob URLs (L3)

**Files:**
- Modify: `src/lib/blob-rules.ts`, `src/lib/blob.ts`, `src/actions/forms.ts`, `src/actions/publications.ts`, `src/actions/meetings.ts`
- Test: `tests/app/blob-rules.test.ts` (extend)

**Interfaces:**
- Consumes: existing `isAllowedBlobUrl(url: string): boolean` in `src/lib/blob-rules.ts`.
- Produces: `detectUploadType(fileName: string, head: Uint8Array): string | null` in `src/lib/blob-rules.ts` — the content type to store, or `null` when the extension is not allowed or the leading bytes do not match it.

- [ ] **Step 1: Add failing tests** to `tests/app/blob-rules.test.ts`:

  - `detectUploadType("a.pdf", bytes("%PDF-1.7"))` → `"application/pdf"`.
  - `detectUploadType("REPORT.PDF", bytes("%PDF-1.4"))` → `"application/pdf"`.
  - `detectUploadType("a.pdf", bytes("<html><script>"))` → `null`.
  - `"a.png"` with `89 50 4E 47 0D 0A 1A 0A` → `"image/png"`; `"a.jpg"` and `"a.jpeg"` with `FF D8 FF` → `"image/jpeg"`; `"a.webp"` with `RIFF????WEBP` → `"image/webp"`.
  - `"a.png"` with JPEG bytes → `null` (extension and content must agree).
  - `"page.html"`, `"a.svg"`, `"noextension"`, `"a.pdf.exe"` → `null`.
  - empty `head` → `null`.

- [ ] **Step 2: Run** `npx vitest run tests/app/blob-rules.test.ts` — expected: the new cases fail.

- [ ] **Step 3: Implement `detectUploadType`.**

- [ ] **Step 4: Use it in `uploadFile`** (`src/lib/blob.ts`): read the first 16 bytes of the file, call `detectUploadType(file.name, head)`, throw the existing "File type not allowed" error on `null`, and call `put(pathname, file, { access: "public", contentType: type, addRandomSuffix: true })`. Keep the size check and the returned shape. Remove the `file.type` check.

- [ ] **Step 5: Validate stored URLs.** In `src/actions/forms.ts`, `publications.ts` and `meetings.ts`, wherever a `blobUrl` from the request is stored or passed to a delete, reject it with `throw new Error("Invalid file")` unless `isAllowedBlobUrl(blobUrl)` (an empty/absent value stays allowed where it is optional today). Follow the pattern at `src/actions/upload.ts:22`.

- [ ] **Step 6: Run** `npm test`, `npm run typecheck`, eslint on the changed files — expected: clean.

- [ ] **Step 7: Commit** — `fix(security): decide upload type from file content; validate stored blob URLs`

### Task 5: Response headers, pinned image host, search limit (L1, L2, L4)

**Files:**
- Create: `src/lib/security-headers.ts`
- Modify: `next.config.ts`, `src/lib/rate-limit.ts`, `src/app/api/search/route.ts`
- Test: `tests/app/security-headers.test.ts`, `tests/app/rate-limit.test.ts`

**Interfaces:**
- Produces (from `src/lib/security-headers.ts`, no imports beyond the standard library, because `next.config.ts` imports it by relative path):
  - `blobHostFromToken(token: string | undefined): string` — `vercel_blob_rw_AbC123_secret` → `abc123.public.blob.vercel-storage.com`; anything else (undefined, empty, wrong prefix, fewer than five `_`-separated parts) → `*.public.blob.vercel-storage.com`.
  - `buildCsp(opts: { isDev: boolean; blobHost: string }): string`
  - `PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=()"`

- [ ] **Step 1: Write the failing tests.**

  `tests/app/security-headers.test.ts`:
  - `blobHostFromToken` for the cases listed above.
  - `buildCsp({ isDev: false, blobHost: "abc.public.blob.vercel-storage.com" })`: `script-src` has `'self'` and `'unsafe-inline'` and no `'unsafe-eval'`; contains `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`; `img-src` contains `https://abc.public.blob.vercel-storage.com` and no `*`.
  - `buildCsp({ isDev: true, … })` contains `'unsafe-eval'`.
  - every directive already in today's CSP (`default-src 'self'`, `style-src 'self' 'unsafe-inline'`, `font-src 'self' https://fonts.gstatic.com`, `connect-src 'self'`, `img-src 'self' data: blob:`) is still present.

  `tests/app/rate-limit.test.ts`:
  - the 31st call inside one minute for one key returns `ok: false`; a call after the window returns `ok: true`.
  - new export `rateLimitKeyCount(): number`: after a key's window has fully expired and any other key is used, the expired key is no longer counted.

- [ ] **Step 2: Run** both test files — expected: fail (module / export not found).

- [ ] **Step 3: Implement `src/lib/security-headers.ts`.**

- [ ] **Step 4: Use it in `next.config.ts`**: compute `blobHost = blobHostFromToken(process.env.BLOB_READ_WRITE_TOKEN)`; set `images.remotePatterns` hostname to `blobHost`; replace the CSP string with `buildCsp({ isDev: process.env.NODE_ENV !== "production", blobHost })`; add the `Permissions-Policy` header; set `poweredByHeader: false`. Leave every other header, cache rule and redirect as is.

- [ ] **Step 5: Eviction in `src/lib/rate-limit.ts`**: when a call finds a key whose timestamps are all outside the window, delete it before re-creating it, and on each call sweep at most 50 other keys for the same condition. Export `rateLimitKeyCount`. Keep the `rateLimit` signature and result shape.

- [ ] **Step 6: Limit `/api/search`**: at the top of `GET`, `rateLimit(\`search:${clientIp(req.headers)}\`, 30, 60_000)`; when not ok, return `NextResponse.json({ results: [] }, { status: 429 })`.

- [ ] **Step 7: Run** `npm test`, `npm run typecheck`, eslint on the changed files, then `npm run build` — expected: clean, and the build output still lists the static pages as static (`○`).

- [ ] **Step 8: Commit** — `fix(security): tighter CSP and headers, pinned blob image host, search rate limit`

### Task 6: Script hardening and dependency cleanup (L6, L7, L8)

**Files:**
- Modify: the 14 scripts listed by `grep -rln "rejectUnauthorized: false" scripts`, `scripts/seed.ts`, `package.json` / `package-lock.json`
- Create: `scripts/lib/seed-guard.ts`
- Test: `tests/app/scripts-hardening.test.ts`

**Interfaces:**
- Consumes: `scriptPgConfig(url: string, applicationName?: string): ClientConfig` from `scripts/lib/pg.ts`.
- Produces: `assertSeedAllowed(input: { password: string | undefined; existingUsers: number; argv: readonly string[] }): string` in `scripts/lib/seed-guard.ts` — returns the password, or throws.

- [ ] **Step 1: Write the failing tests** in `tests/app/scripts-hardening.test.ts`:

  - walking `scripts/` and `src/` (all `.ts`/`.tsx`), no file contains `rejectUnauthorized: false`.
  - `scripts/seed.ts` does not contain `changeme`.
  - `package.json` `dependencies` and `devDependencies` have no `sharp` key.
  - `assertSeedAllowed({ password: undefined, existingUsers: 0, argv: [] })` throws `/INITIAL_ADMIN_PASSWORD/`.
  - a 13-character password throws; a 14-character password with `existingUsers: 0` returns it.
  - `existingUsers: 1` without `--wipe` throws `/--wipe/`; with `--wipe` in `argv` returns the password.

- [ ] **Step 2: Run** the test file — expected: fails.

- [ ] **Step 3: Replace insecure TLS** in all 14 scripts: each `new Client({ connectionString: X, ssl: { rejectUnauthorized: false } })` (or `Pool`) becomes `new Client(scriptPgConfig(X))`, importing `scriptPgConfig` from the correct relative path to `scripts/lib/pg`. Change nothing else in those files. Do not run them.

- [ ] **Step 4: Guard `scripts/seed.ts`**: implement `assertSeedAllowed`; in `seed()`, count rows in `users` first and call `assertSeedAllowed({ password: process.env.INITIAL_ADMIN_PASSWORD, existingUsers, argv: process.argv.slice(2) })` before any delete; use its return value as the password. Remove the literal fallback.

- [ ] **Step 5: Remove `sharp`**: `npm uninstall sharp`, then `npm run build` to prove nothing needs it. If the build fails for a reason tied to `sharp`, stop and report BLOCKED with the error instead of re-adding it.

- [ ] **Step 6: Run** `npm test`, `npm run typecheck`, eslint on the changed files — expected: clean. `npm audit --omit=dev` — record the result in the report.

- [ ] **Step 7: Commit** — `fix(security): pinned TLS in all scripts, guarded seed, drop unused sharp`
