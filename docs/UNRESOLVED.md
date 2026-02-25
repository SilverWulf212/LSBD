# Unresolved Items & Known Gaps

## Must-Do Before Launch

### 1. External Portal URLs — NEED CONFIRMATION
The licensee login and license verification URLs are placeholders:
- `EXTERNAL_LINKS.licenseeLogin` in `src/lib/constants.ts` → currently `https://lsbd.diversifiedtech.com`
- `EXTERNAL_LINKS.licenseVerification` → currently `https://lsbd.diversifiedtech.com/verify`

**Action**: Confirm exact URLs with Erin/LSBD IT.

### 2. PDF Content Migration
All existing PDFs from the current site need to be uploaded to Vercel Blob via the admin interface:
- ~20 meeting documents (notices, agendas, minutes from 2021-2026)
- ~25 downloadable forms
- ~14 publications (The Bulletin 2004-2018)
- 2 policy documents (Sexual Harassment Policy, ADA Policy)

**Action**: Erin uploads via admin, or we script a bulk migration.

### 3. Board Member Data Verification
The seed script has board member names from the current site, but:
- Districts assignments may have changed
- Headshot photos are not included (no photos on current site)
- Terms/appointment dates not captured

**Action**: Erin verifies board member data via admin after first login.

### 4. Fee Schedule Verification
Fee amounts in the seed script are from the current site but should be verified:
- Some fees may have been updated since the content was scraped
- Additional fee categories may exist

**Action**: Erin verifies via admin `/admin/fees`.

### 5. DNS Cutover Plan
Switching `lsbd.org` from the old hosting to Vercel needs coordination:
- Current site is served from an older hosting provider
- DNS change will cause brief downtime during propagation
- Old `.htm` URLs have 301 redirects configured, but need testing

**Action**: Schedule cutover during low-traffic period. Test redirects thoroughly.

---

## Should-Do Post-Launch

### 6. Email-Based Password Reset
Currently password reset requires CLI access (`scripts/reset-password.ts`). A proper email-based flow via Resend or Postmark should be added for Erin's convenience.

### 7. Content Migration Script
A script to scrape remaining content from the current `lsbd.org` pages and populate `pageSections` with actual content (laws & rules text, licensing pathways, CE requirements, etc.). Currently these pages use mock/placeholder content.

### 8. Lighthouse Accessibility Audit
Run full Lighthouse audit on every page post-deployment and fix any issues:
```bash
npx lighthouse https://lsbd.org --only-categories=accessibility --output=json
```
Target: 100 score on all pages.

### 9. Screen Reader Testing
Manual testing with:
- NVDA (Windows)
- VoiceOver (macOS/iOS)
- TalkBack (Android)

Focus on: navigation flow, form completion, PDF link announcements, alert announcements.

### 10. Cross-Browser Testing
Test on:
- Chrome, Firefox, Safari, Edge (desktop)
- Safari iOS, Chrome Android (mobile)
- 320px, 768px, 1024px, 1440px breakpoints

### 11. Analytics
No analytics integration yet. Options:
- Vercel Analytics (built-in, privacy-friendly)
- Google Analytics (if required by state policy)
- Plausible (privacy-first alternative)

### 12. Admin Training Document
Create a walkthrough guide for Erin covering:
- How to log in
- How to create/edit blog posts
- How to manage alerts
- How to upload meeting documents
- How to edit page content

---

## Nice-to-Have / Future

### 13. Newsletter Subscription
The website_init.md mentions a newsletter subscribe option (like pharmacy.la.gov). Not implemented yet. Would need an email service (Resend, Mailchimp, etc.).

### 14. Events Calendar
Homepage could show upcoming board meetings in a calendar format instead of a list.

### 15. Advanced Search
Current search uses `ILIKE` queries. Could upgrade to PostgreSQL full-text search with `tsvector`/`tsquery` for better relevance ranking and performance.

### 16. Image Optimization
The client-provided images in `public/lsbd_images/10/` should be optimized:
- Convert PNGs to WebP for smaller file sizes
- Generate responsive sizes (640w, 1024w, 1280w)
- Currently using `next/image` which handles some optimization at runtime

### 17. Automated Accessibility CI
Add `@axe-core/react` and `jest-axe` to the test suite for automated accessibility regression testing on every deploy.
