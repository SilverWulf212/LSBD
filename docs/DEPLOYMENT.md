# LSBD.org Deployment Guide

## Prerequisites

- GitHub repo: https://github.com/SilverWulf212/LSBD (private)
- Branch: `main` (tagged `v1.0.0`)
- Vercel account with access to Postgres and Blob storage

---

## Step 1: Create Vercel Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the `SilverWulf212/LSBD` repository
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `/` (default)
5. Click **Deploy** — it will fail on first try without env vars, that's expected

---

## Step 2: Provision Storage

In the Vercel dashboard for the LSBD project:

### Postgres Database
1. Go to **Storage** tab
2. Click **Create Database** → **Postgres**
3. Name it `lsbd-db` (or similar)
4. Region: **US East** (closest to Baton Rouge)
5. Click **Connect to Project** — this auto-populates these env vars:
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NO_SSL`
   - `POSTGRES_URL_NON_POOLING`
   - `POSTGRES_USER`
   - `POSTGRES_HOST`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DATABASE`

### Blob Storage
1. Still in **Storage** tab
2. Click **Create Store** → **Blob**
3. Name it `lsbd-files`
4. Click **Connect to Project** — this auto-populates:
   - `BLOB_READ_WRITE_TOKEN`

---

## Step 3: Set Environment Variables

In the Vercel dashboard → **Settings** → **Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `AUTH_SECRET` | Generate with: `openssl rand -base64 32` | Required for session encryption |
| `AUTH_URL` | `https://your-project.vercel.app` | Update to `https://lsbd.org` after domain setup |
| `INITIAL_ADMIN_PASSWORD` | A strong temporary password | Used only by the seed script, delete after seeding |

---

## Step 4: Redeploy

After setting all env vars:
1. Go to **Deployments** tab
2. Click the three dots on the latest deployment → **Redeploy**
3. Wait for successful build (should compile all 54 routes)

---

## Step 5: Run Database Migrations & Seed

Once the app is deployed and Postgres is connected:

### Option A: Via Vercel CLI (recommended)
```bash
npm i -g vercel
vercel link  # link to the LSBD project
vercel env pull .env.local  # pull production env vars locally
npx drizzle-kit push  # create all tables
npx tsx scripts/seed.ts  # seed initial data
```

### Option B: Via Vercel Functions Log
If you can't run locally, you can create a temporary API route to trigger seeding (remove after use).

### What the seed script creates:
- **Admin user**: erin@lsbd.org with the `INITIAL_ADMIN_PASSWORD`
- **11 board members**: Current board (Dr. LaBorde, Dr. Gaudet, Dr. Carlton, etc.)
- **13 fee entries**: Dentist, hygienist, and miscellaneous fees
- **6 staff members**: Hickham, Connor, Daniel, Isacks, Pourciau, Smith
- **5 page sections**: Homepage hero, scam alert, and audience overviews

---

## Step 6: Configure Custom Domain

1. In Vercel dashboard → **Settings** → **Domains**
2. Add `lsbd.org`
3. Vercel will provide DNS records (either A record or CNAME)
4. Update DNS at the domain registrar:
   - **A Record**: `76.76.21.21` (Vercel)
   - **CNAME**: `cname.vercel-dns.com` (for `www`)
5. Wait for DNS propagation (can take up to 48 hours, usually minutes)
6. Vercel auto-provisions SSL certificate
7. Update `AUTH_URL` env var to `https://lsbd.org`
8. Redeploy

---

## Step 7: Post-Deploy Cleanup

1. **Delete `INITIAL_ADMIN_PASSWORD`** from environment variables
2. **Verify admin login**: Go to `https://lsbd.org/admin/login` and sign in as erin@lsbd.org
3. **Upload existing PDFs**: Via the admin interface, upload all meeting documents, forms, and publications from the current site
4. **Verify old URL redirects**: Test a few `.htm` URLs to confirm 301 redirects work
5. **Submit sitemap**: Go to [Google Search Console](https://search.google.com/search-console) and submit `https://lsbd.org/sitemap.xml`

---

## Admin Interface

**URL**: `https://lsbd.org/admin`
**Login**: erin@lsbd.org + password set during seeding

### Admin Sections
| Section | URL | What It Manages |
|---|---|---|
| Dashboard | `/admin` | Overview stats + recent activity |
| Posts | `/admin/posts` | Blog posts / announcements |
| Alerts | `/admin/alerts` | Homepage alert banners |
| Board Members | `/admin/board` | Board member directory |
| Fees | `/admin/fees` | Fee schedule (inline editing) |
| Meetings | `/admin/meetings` | Meeting records + PDF uploads |
| Forms | `/admin/forms` | Downloadable forms library |
| Publications | `/admin/publications` | The Bulletin archive |
| Staff | `/admin/staff` | Staff directory |
| Page Content | `/admin/pages` | Editable page sections |

### Password Reset
If Erin forgets her password:
```bash
vercel env pull .env.local
npx tsx scripts/reset-password.ts erin@lsbd.org newpassword123
```

---

## Architecture Quick Reference

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Database | Vercel Postgres (Drizzle ORM) |
| File Storage | Vercel Blob |
| Auth | Auth.js v5 (JWT, Credentials provider) |
| Rich Text | Tiptap v2 |
| Hosting | Vercel |

### Key Files
| File | Purpose |
|---|---|
| `src/lib/db/schema.ts` | All 12 database tables |
| `src/lib/auth.ts` | Auth configuration |
| `src/lib/constants.ts` | Nav structure, contact info, categories |
| `src/lib/validators.ts` | Zod schemas for all forms |
| `src/actions/*.ts` | Server Actions (CRUD + audit log) |
| `middleware.ts` | Auth middleware for `/admin/*` |
| `next.config.ts` | Redirects, security headers, image config |
| `scripts/seed.ts` | Database seeding script |
