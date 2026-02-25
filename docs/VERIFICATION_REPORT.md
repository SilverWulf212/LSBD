# LSBD Codebase Verification Report

**Date:** 2026-02-25
**Methodology:** Scraped live data from lsbd.org pages and compared against all codebase files and the live database.
**Sources:** boardinfo.htm, fees.htm, contactus.htm, conted.htm, licenseinfo.htm, renewals.htm

---

## 1. Board Members (seed.ts + live database)

Source: https://www.lsbd.org/boardinfo.htm
File: `/scripts/seed.ts` lines 40-56

| # | Name | Role | District | Status |
|---|------|------|----------|--------|
| 1 | Dr. Kimberly Caldwell | President | 4th | **PASS** |
| 2 | Dr. David Baughman | Vice President | 2nd | **PASS** |
| 3 | Dr. Nelson Daly | Secretary-Treasurer | 8th | **PASS** |
| 4 | Dr. Donald Bennett | Member | 5th | **PASS** |
| 5 | Dr. Terry Billings | Member | 5th | **PASS** |
| 6 | Dr. Michael Casadaban | Member | 8th | **PASS** |
| 7 | Dr. David Chambers | Member | 1st | **PASS** |
| 8 | Dr. Stephen Chapman | Member | 3rd | **PASS** |
| 9 | Dr. Adam Cormier | Member | 7th | **PASS** |
| 10 | Dr. Griffin Deen | Member | 6th | **PASS** |
| 11 | Dr. Jeetendra Patel | Member | 4th | **PASS** |
| 12 | Dr. Thomas Price | Member | 9th | **PASS** |
| 13 | Dr. Joshua Reaves | Member | 1st | **PASS** |
| 14 | Joelle Breaux, R.D.H. | Hygienist Representative | (Dental Hygienist) | **PASS** |
| 15 | Mr. Carlos Zelaya | Consumer Member | (Consumer Member) | **PASS** |

**Board Members Total: 15/15 PASS**

Live database query confirms all 15 members match exactly.

---

## 2. Staff Members (seed.ts + live database)

Source: https://www.lsbd.org/contactus.htm
File: `/scripts/seed.ts` lines 89-96

| # | Name | Title (ours) | Title (live site) | Email | Status |
|---|------|-------------|-------------------|-------|--------|
| 1 | Arthur F. Hickham, Jr. | Executive Director | Executive Director | ahickham@lsbd.org | **PASS** |
| 2 | Erin Conner | Assistant Executive Director | Assistant Executive Director | erin@lsbd.org | **PASS** |
| 3 | Rachel Daniel | Administrative Assistant | Administrative Assistant | rachel@lsbd.org | **PASS** |
| 4 | Alexx Smith | Inspector | Inspector | alexx@lsbd.org | **PASS** |
| 5 | Iris Pourciau | Administrative Coordinator -- Licensing | Administrative Coordinator--Licensing | iris@lsbd.org | **PASS** (minor: our code uses en-dash, site uses double-dash; acceptable normalization) |
| 6 | Meg Isacks | Administrative Coordinator -- Front Desk | Administrative Coordinator--Front Desk | meg@lsbd.org | **PASS** (same note as above) |

**Staff Total: 6/6 PASS**

Live database query confirms all 6 staff members match.

---

## 3. Fee Schedule (seed.ts + live database)

Source: https://www.lsbd.org/fees.htm
File: `/scripts/seed.ts` lines 63-82

### Dentist Fees

| Fee | Our Amount (cents) | Our Amount ($) | Live Site | Status |
|-----|-------------------|----------------|-----------|--------|
| LBE | 35000 | $350.00 | $350 | **PASS** |
| LBC | 205000 | $2,050.00 | $2,050 | **PASS** |
| Biennial Renewal | 59000 | $590.00 | $590 | **PASS** |
| Personal Nitrous Permit | 5000 | $50.00 | $50 | **PASS** |
| Personal Nitrous Permit Renewal | 5000 | $50.00 | $50 | **PASS** |
| Moderate Sedation/GA Permit | 40000 | $400.00 | $400 | **PASS** |
| Moderate Sedation/GA Permit Renewal | 20000 | $200.00 | $200 | **PASS** |

### Hygienist Fees

| Fee | Our Amount (cents) | Our Amount ($) | Live Site | Status |
|-----|-------------------|----------------|-----------|--------|
| LBE | 18000 | $180.00 | $180 | **PASS** |
| LBC | 83000 | $830.00 | $830 | **PASS** |
| Biennial Renewal | 23000 | $230.00 | $230 | **PASS** |
| Nitrous Oxide Permit | 5000 | $50.00 | $50 | **PASS** |
| Local Anesthesia Permit | 5000 | $50.00 | $50 | **PASS** |

### Miscellaneous Fees

| Fee | Our Amount (cents) | Our Amount ($) | Live Site | Status |
|-----|-------------------|----------------|-----------|--------|
| EDDA Certification Confirmation | 10000 | $100.00 | $100 | **PASS** |
| Official List (full) | 50000 | $500.00 | $500 | **PASS** |
| Official List (up to 1/2) | 25000 | $250.00 | $250 | **PASS** |

**Fees Total: 15/15 PASS**

Live database query confirms all 15 fees match exactly.

---

## 4. Dentist Licensure Page

Source: https://www.lsbd.org/licenseinfo.htm
File: `/src/app/(public)/dentists/licensure/page.tsx`

| Check | Status | Details |
|-------|--------|---------|
| LBE fee = $350.00 | **PASS** | Line 47: "Application fee: $350.00" |
| LBC fee = $2,050.00 | **PASS** | Line 93: "Application fee: $2,050.00" |
| LBC requires 3 years (1,000 hrs/yr) | **PASS** | Line 85: "Minimum of three (3) years of active clinical practice (minimum 1,000 hours per year)" |
| Criminal background check listed | **PASS** | Line 45 (LBE) and line 90 (LBC): "Criminal fingerprint background check" |
| ADEX 5-year limit listed | **PASS** | Line 43 (LBE) and line 88 (LBC): "ADEX clinical examination completed within 5 years of application" |

**Dentist Licensure Total: 5/5 PASS**

---

## 5. Hygienist Licensure Page

Source: https://www.lsbd.org/licenseinfo.htm
File: `/src/app/(public)/hygienists/licensure/page.tsx`

| Check | Status | Details |
|-------|--------|---------|
| LBE fee = $180.00 | **PASS** | Line 31: "Application fee: $180.00" |
| LBC fee = $830.00 | **PASS** | Line 54: "Application fee: $830.00" |
| LBC requires 1 year (1,000 hrs) | **PASS** | Line 54: "Minimum of one (1) year of active clinical practice (minimum 1,000 hours)" |
| Criminal background check listed | **PASS** | Line 31 (LBE) and line 54 (LBC): "Criminal fingerprint background check" |
| ADEX 3-year limit listed | **PASS** | Line 31 (LBE) and line 54 (LBC): "ADEX clinical examination completed within 3 years of application" |

**Hygienist Licensure Total: 5/5 PASS**

---

## 6. Dentist Renewal Page

Source: https://www.lsbd.org/renewals.htm
File: `/src/app/(public)/dentists/renewal/page.tsx`

| Check | Status | Details |
|-------|--------|---------|
| Says "biennial" NOT "annual" | **PASS** | Metadata (line 12), header (line 19), fee label (line 98), timeline (line 63) all say "biennial" |
| Does NOT promote online renewal | **PASS** | Lines 27-31: "Important: Online Renewals Discontinued" banner, "Online license renewals are no longer available" |
| Has mail-in instructions | **PASS** | Line 19: "Submit renewal applications by mail with check or money order" |
| Renewal fee = $590.00 | **PASS** | Line 99: "$590.00" |
| No annual opioid CE claim | **PASS** | Line 128: "Opioid management CE completed (one-time requirement)" -- correctly says one-time |
| No malpractice insurance in checklist | **PASS** | Checklist (lines 126-129) contains only CE, BLS, opioid, and address -- no malpractice |

**Dentist Renewal Total: 6/6 PASS**

---

## 7. Hygienist Renewal Page

Source: https://www.lsbd.org/renewals.htm
File: `/src/app/(public)/hygienists/renewal/page.tsx`

| Check | Status | Details |
|-------|--------|---------|
| Says "biennial" NOT "annual" | **PASS** | Metadata (line 11), header (line 17), fee label (line 70) all say "biennial" |
| Does NOT promote online renewal | **PASS** | Lines 24-26: "Mail-In Renewal Only" banner, "Online license renewals are no longer available" |
| Renewal fee = $230.00 | **PASS** | Line 70: "$230.00" |
| No opioid CE in checklist | **PASS** | Checklist (line 86) contains only CE hours, BLS, and address -- no opioid listed |

**Hygienist Renewal Total: 4/4 PASS**

---

## 8. Dentist Continuing Education Page

Source: https://www.lsbd.org/conted.htm
File: `/src/app/(public)/dentists/continuing-ed/page.tsx`

| Check | Status | Details |
|-------|--------|---------|
| BLS: AHA and ARC ONLY (no "or equivalent") | **PASS** | Line 73: "American Heart Association BLS Provider and American Red Cross BLS only." |
| Online BLS NEVER accepted | **PASS** | Line 74: "Online-only BLS courses are NEVER accepted." |
| Opioid: ONE-TIME, not annual | **PASS** | Line 88: "THREE (3) hours -- ONE-TIME requirement (since 2018 renewal cycle)" |
| Opioid: Dentists only | **PASS** | Card is present only on dentist CE page, not on hygienist CE page |

**Dentist CE Total: 4/4 PASS**

---

## 9. Hygienist Continuing Education Page

Source: https://www.lsbd.org/conted.htm
File: `/src/app/(public)/hygienists/continuing-ed/page.tsx`

| Check | Status | Details |
|-------|--------|---------|
| BLS: AHA and ARC ONLY | **PASS** | Line 51: "American Heart Association BLS Provider or American Red Cross BLS only." |
| Online BLS NEVER accepted | **PASS** | Line 52: "Online-only BLS courses are NEVER accepted." |
| NO opioid requirement listed | **PASS** | No opioid section/card present on this page. Only General CE, BLS, and CE Broker cards. |

**Hygienist CE Total: 3/3 PASS**

---

## 10. Hub Pages

### Dentist Hub Page
File: `/src/app/(public)/dentists/page.tsx`

| Check | Status | Details |
|-------|--------|---------|
| Renewal description says biennial | **PASS** | Line 27: "Submit biennial renewal applications by mail before the deadline" |
| CE description says one-time opioid | **PASS** | Line 34: "Opioid management CE is a one-time requirement." |

### Hygienist Hub Page
File: `/src/app/(public)/hygienists/page.tsx`

| Check | Status | Details |
|-------|--------|---------|
| Renewal description says biennial | **PASS** | Line 24: "biennial (every two years) cycle" |
| CE description does NOT mention opioid | **PASS** | Line 30: Only mentions "12 hours of approved continuing education per biennial renewal cycle, including BLS certification" -- no opioid |

**Hub Pages Total: 4/4 PASS**

---

## 11. Contact Information

Source: https://www.lsbd.org/contactus.htm
File: `/src/lib/constants.ts` lines 5-11

| Check | Status | Details |
|-------|--------|---------|
| Phone: 225-219-7330 | **PASS** | Line 6: `phone: "225-219-7330"` |
| Fax: 225-219-0707 | **PASS** | Line 7: `fax: "225-219-0707"` |
| Physical: 18212 East Petroleum Drive, Suite 2-B, Baton Rouge, LA 70809 | **PASS** | Line 9: `physicalAddress: "18212 East Petroleum Drive, Suite 2-B, Baton Rouge, Louisiana 70809"` |
| Mailing: P.O. Box 5256, Baton Rouge, LA 70821-5256 | **PASS** | Line 8: `mailingAddress: "P.O. Box 5256, Baton Rouge, Louisiana 70821-5256"` |

**Contact Info Total: 4/4 PASS**

---

## 12. External Links

File: `/src/lib/constants.ts` lines 13-19

| Check | Status | Details |
|-------|--------|---------|
| dentistLogin: https://www.membersbase.com/lsbd/dentist | **PASS** | Line 14 |
| hygienistLogin: https://www.membersbase.com/lsbd/hygienist | **PASS** | Line 15 |
| licenseVerification: https://www.member-base.net/lsbdweb/licenseverification.htm | **PASS** | Line 16 |

**External Links Total: 3/3 PASS**

---

## 13. Live Database Verification

Queried the live database directly and verified:
- **Board Members:** All 15 records match seed data and lsbd.org exactly -- **PASS**
- **Staff Members:** All 6 records match seed data and lsbd.org exactly -- **PASS**
- **Fees:** All 15 records match seed data and lsbd.org exactly -- **PASS**

**Database Total: 3/3 PASS**

---

## 14. Additional Issues Found (Outside Primary Checks)

These items were discovered during the review and represent factual inaccuracies in files NOT in the primary check list:

### FAIL Items

| # | File | Issue | Current Text | Should Be |
|---|------|-------|-------------|-----------|
| 1 | `/scripts/seed.ts` line 286 | Opioid CE exemption form description says "annual" | `"Request exemption from annual opioid management CE requirement"` | `"Request exemption from opioid management CE requirement"` (opioid is ONE-TIME per lsbd.org/conted.htm) |
| 2 | `/src/lib/mock-data.ts` line 451 | Same issue in mock data | `"Request exemption from annual opioid management CE requirement"` | `"Request exemption from opioid management CE requirement"` |
| 3 | `/src/app/(public)/resources/rulemaking/page.tsx` line 48 | Rulemaking page claims opioid CE is annual | `"Increased mandatory opioid management CE to three (3) hours annually for all licensees."` | Should say "one-time" requirement for dentists only, per lsbd.org/conted.htm. Also incorrectly says "all licensees" when it is dentists only. |

---

## Summary

### Primary Verification Checks: 62/62 PASS

| Category | Result |
|----------|--------|
| Board Members (15 members) | 15/15 PASS |
| Staff Members (6 staff) | 6/6 PASS |
| Fee Schedule (15 fees) | 15/15 PASS |
| Dentist Licensure Page (5 checks) | 5/5 PASS |
| Hygienist Licensure Page (5 checks) | 5/5 PASS |
| Dentist Renewal Page (6 checks) | 6/6 PASS |
| Hygienist Renewal Page (4 checks) | 4/4 PASS |
| Dentist CE Page (4 checks) | 4/4 PASS |
| Hygienist CE Page (3 checks) | 3/3 PASS |
| Hub Pages (4 checks) | 4/4 PASS |
| Contact Info (4 checks) | 4/4 PASS |
| External Links (3 checks) | 3/3 PASS |
| Live Database (3 checks) | 3/3 PASS |

### Additional Issues Found: 3 FAIL

All 3 additional fails relate to the word "annual" being used incorrectly for the opioid CE requirement, which is a ONE-TIME requirement for dentists only (not annual, and not for all licensees):

1. **`/scripts/seed.ts` line 286** -- Form description says "annual" instead of omitting it (one-time requirement)
2. **`/src/lib/mock-data.ts` line 451** -- Same issue in mock data
3. **`/src/app/(public)/resources/rulemaking/page.tsx` line 48** -- Says "annually for all licensees" when it should be one-time for dentists only

### Overall Verdict: 62/62 primary checks PASS, 3 additional issues found in ancillary files
