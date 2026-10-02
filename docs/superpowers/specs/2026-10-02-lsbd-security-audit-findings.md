# LSBD site security audit — findings and fix decisions (2026-10-02)

Source: a read-only audit of commit `b3cb823` (what production runs) and of
`https://lsbd-sigma.vercel.app`, following the third-party "vibe-security" checklist
(`github.com/raroque/vibe-security-skill`, commit `850938f`). The audit made no writes, no
login attempts and no direct database connections. Each finding is marked **verified**
(code path read end to end, or observed live) or **inferred**.

No Critical findings. The anon-key hole closed by `0005` is confirmed closed live: all 12
tables in `public` answer `permission denied` to the anon key.

## Findings

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| H1 | High | `src/lib/auth.ts:15-34` | No limit, lockout or MFA on the admin password login. Unknown emails return before any bcrypt work, so response time shows which emails exist. Minimum password length is 8. | verified in code |
| M1 | Medium | `drizzle/0002_rls.sql:41-89`, live | The anon key reads `public.public_licensee` over REST: 13,001 rows at 1,000 per request, bypassing the site's limits, and the `action` column, which the site shows only for `PRB` status. 227 `ACT` rows have non-empty `action`. | verified live |
| M2 | Medium | `src/components/content/post-content.tsx:9`, `src/actions/posts.ts`, `src/lib/validators.ts:23` | Post `content` is stored raw and rendered with `dangerouslySetInnerHTML`. A `cms.write` user can run script for every visitor and, through an admin's session, create an admin user. | verified in code |
| M3 | Medium | `src/lib/auth.ts:37-53` | The role is copied into the JWT at sign-in and never re-checked; default lifetime 30 days. A deleted, demoted or password-reset user keeps access. | verified in code |
| M4 | Medium | Vercel `POSTGRES_URL` | The site connects as `postgres`, which bypasses RLS, so any server-side bug reaches every schema. | inferred |
| L1 | Low | `next.config.ts:17-24` | CSP allows `'unsafe-inline'` and `'unsafe-eval'` scripts; no `Permissions-Policy`; `X-Powered-By` is sent. | verified live |
| L2 | Low | `src/lib/rate-limit.ts`, `src/app/api/search/route.ts` | The limiter is per serverless instance and never evicts keys; `/api/search` has no limit and runs three wildcard `ILIKE` queries per call. | verified in code |
| L3 | Low | `src/lib/blob.ts:8-17`; `src/actions/forms.ts`, `publications.ts`, `meetings.ts` | Upload type check trusts the browser-supplied MIME type and keeps the extension; stored `blobUrl` values in those three actions are not validated before being passed to `del()`. | verified in code |
| L4 | Low | `next.config.ts:9` | The image optimizer accepts any Vercel Blob store (`*.public.blob.vercel-storage.com`). | verified in config |
| L5 | Low | Supabase Auth | Public email sign-up is enabled but unused (`disable_signup: false`). | verified live |
| L6 | Low | 14 files in `scripts/` | `rejectUnauthorized: false` on connections that use the database owner credentials. | verified in code |
| L7 | Low | `scripts/seed.ts:25,29` | Hardcoded fallback admin password; the script also deletes all users. | verified in code |
| L8 | Low | `package.json` | `sharp ^0.34.5` carries a high-severity advisory; nothing imports it. | inferred |

Checked and clean: secrets in tracked files, history and the client bundle; capability
gates on all 54 server actions, every admin page and `/api/upload`; no password hashes sent
to the browser; SQL injection and mass assignment; session cookie flags; `/.git`, `.env`
and source maps on the live site; HSTS, frame, nosniff and referrer headers.

Not checked: Vercel settings (Preview protection, shared `AUTH_SECRET`), database contents,
live login behaviour, Blob response headers, Supabase beyond anon REST GETs.

## Decisions

Code fixes (this plan), one branch `fix/security-audit` off `main`:

- **H1.** Limit failed sign-ins in Postgres, with no new service: table
  `public.login_attempts` (migration `drizzle/0008_login_attempts.sql`). At most **10**
  failures per IP and **5** per email in a **15 minute** window; a success clears the
  email's failures. Unknown emails do the same bcrypt work as known ones. If the limiter
  itself errors, sign-in is refused (fail closed). Accepted cost: someone who knows an
  email can lock that account's password login for 15 minutes at a time. Entra SSO
  (Stage 1) removes this endpoint.
- **M2.** Sanitize post HTML with `sanitize-html` on write (create and update) and again
  at render. Allow-list = what the Tiptap editor produces: text formatting, headings,
  lists, links, images, tables, text alignment. Links and images: `https`, `mailto` and
  site-relative only.
- **M3.** Sessions last **8 hours**. Every **5 minutes** the JWT callback re-reads the
  user: missing user, or `updated_at` later than the token's issue time, signs out; role
  is refreshed otherwise. A database error during the re-check keeps the session as is
  (a thrown error in the callback would clear the cookie for everyone during an outage).
- **L1.** Add `Permissions-Policy`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`; drop `'unsafe-eval'` outside development; `poweredByHeader: false`.
  **Deferred:** a per-request nonce CSP (it makes every page dynamic and gives up the
  CDN caching the public pages rely on). M2's sanitizer is the control for stored XSS.
- **L2.** Limit `/api/search` to **30 requests per minute per IP** with the existing
  limiter, and evict empty keys. **Deferred:** a shared store for the public limiters.
- **L3.** Decide the content type from an extension allow-list (`pdf`, `jpg`, `jpeg`,
  `png`, `webp`) and the file's leading bytes, not `file.type`; pass that content type to
  `put`; add a random suffix. Validate `blobUrl` with the existing `isAllowedBlobUrl` in
  the forms, publications and meetings actions.
- **L4.** Pin the image host to this project's store, derived at build time from
  `BLOB_READ_WRITE_TOKEN` (`vercel_blob_rw_<storeId>_<secret>` → `<storeid>.public.blob.vercel-storage.com`,
  lowercased); keep the wildcard only when the token is absent (CI, local).
- **L6.** All 14 scripts connect through `scriptPgConfig` in `scripts/lib/pg.ts`
  (pinned CA). No script is deleted.
- **L7.** `seed.ts` requires `INITIAL_ADMIN_PASSWORD` of 14+ characters and refuses to run
  when `public.users` has rows unless `--wipe` is passed.
- **L8.** Remove the unused `sharp` dependency.

Operator steps (not code; the user runs them):

- **M1.** Apply `drizzle/0007_public_view_owner_rights.sql`, then
  `scripts/verify-rls.ts --stage=0007`. Decide separately whether `action` should be
  public for `ACT` rows.
- **M4.** Apply `drizzle/0006_db_roles.sql`, give `lsbd_app` a login, point `POSTGRES_URL`
  at it (`docs/RUNBOOK-DB-ROLES.md`).
- **H1.** Apply `drizzle/0008_login_attempts.sql` **before** this branch is deployed;
  after it, re-apply `0006` if `0006` was applied first (it grants `lsbd_app` on every
  table in `public`).
- **L5.** Supabase dashboard → Authentication → turn off new sign-ups.
