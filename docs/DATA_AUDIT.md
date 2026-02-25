# LSBD Website Data Audit Report

**Date:** February 25, 2026
**Source:** Live scrape of https://www.lsbd.org (all pages fetched February 25, 2026)
**Purpose:** Verify all factual data in our project against the current official LSBD website

---

## Table of Contents

1. [Board Members](#1-board-members)
2. [Staff Directory](#2-staff-directory)
3. [Fee Schedule](#3-fee-schedule)
4. [Contact Information](#4-contact-information)
5. [Continuing Education Requirements](#5-continuing-education-requirements)
6. [Renewal Information](#6-renewal-information)
7. [Licensure Requirements](#7-licensure-requirements)
8. [External Links](#8-external-links)
9. [Miscellaneous Issues](#9-miscellaneous-issues)
10. [Summary of Required Fixes](#10-summary-of-required-fixes)

---

## 1. Board Members

### Current Site (lsbd.org/boardinfo.htm) - 15 members:

| # | Name | Role | District |
|---|------|------|----------|
| 1 | Dr. Kimberly Caldwell | President | 4th District |
| 2 | Dr. David Baughman | Vice President | 2nd District |
| 3 | Dr. Nelson Daly | Secretary-Treasurer | 8th District |
| 4 | Dr. Donald Bennett | Member | 5th District |
| 5 | Dr. Terry Billings | Member | 5th District |
| 6 | Dr. Michael Casadaban | Member | 8th District |
| 7 | Dr. David Chambers | Member | 1st District |
| 8 | Dr. Stephen Chapman | Member | 3rd District |
| 9 | Dr. Adam Cormier | Member | 7th District |
| 10 | Dr. Griffin Deen | Member | 6th District |
| 11 | Dr. Jeetendra Patel | Member | 4th District |
| 12 | Dr. Thomas Price | Member | 9th District |
| 13 | Dr. Joshua Reaves | Member | 1st District |
| 14 | Joelle Breaux, R.D.H. | Dental Hygienist Member | N/A |
| 15 | Mr. Carlos Zelaya | Consumer Member | N/A |

### seed.ts Data - 11 members:

| # | Name | Role | District |
|---|------|------|----------|
| 1 | Dr. Marija Hedano LaBorde | President | 7th |
| 2 | Dr. Russell Gaudet | Vice President | 3rd |
| 3 | Dr. David Carlton | Secretary-Treasurer | 5th |
| 4 | Dr. Clayton Coffey | Member | 1st |
| 5 | Dr. Joseph Simone III | Member | 2nd |
| 6 | Dr. Troy Baughman | Member | 4th |
| 7 | Dr. Brian LeBlanc | Member | 6th |
| 8 | Dr. Trey Carlton | Member | 8th |
| 9 | Dr. Courtney Klibert Cortez | Member | 9th |
| 10 | Ms. Victoria Usry, R.D.H. | Hygienist Rep | N/A |
| 11 | Mr. Nick Muscarello | Consumer Member | N/A |

### mock-data.ts Data - 8 members:

| # | Name | Role | District |
|---|------|------|----------|
| 1 | Dr. Robert Barsley | President | 6th District |
| 2 | Dr. Marija LaSalle | Vice President | 5th District |
| 3 | Dr. Claudia Cavallino | Secretary-Treasurer | 1st District |
| 4 | Dr. Thomas Price | Member | 2nd District |
| 5 | Dr. Glenn Dubroc | Member | 3rd District |
| 6 | Dr. Courtney Richey | Member | 4th District |
| 7 | Susan Thibodeaux, RDH | Hygienist Rep | N/A |
| 8 | Mr. Russell Marks | Consumer Member | N/A |

### Verdict:

- **seed.ts:** EVERY MEMBER WRONG. None of the 11 names match the current board. The current board has 15 members (13 dentists + 1 hygienist + 1 consumer). seed.ts has only 11 entries with completely different names, roles, and districts.
- **mock-data.ts:** EVERY MEMBER WRONG. None of the 8 names match the current board. This appears to be an even older roster.
- The current board has 15 members. seed.ts has 11. mock-data.ts has 8. The board also has two members per district for some districts (two in 1st, two in 4th, two in 5th, two in 8th).

| Item | Status | Details |
|------|--------|---------|
| seed.ts board members | WRONG | All 11 names/roles/districts are incorrect. Must be replaced with the 15 current members. |
| mock-data.ts board members | WRONG | All 8 names/roles/districts are incorrect. Must be replaced with the 15 current members. |
| Board member count | WRONG | Current site has 15 members. seed.ts has 11, mock-data.ts has 8. |

---

## 2. Staff Directory

### Current Site (lsbd.org/contactus.htm):

| Name | Title | Email |
|------|-------|-------|
| Arthur F. Hickham, Jr. | Executive Director | ahickham@lsbd.org |
| Erin Conner | Assistant Executive Director | erin@lsbd.org |
| Rachel Daniel | Administrative Assistant | rachel@lsbd.org |
| Alexx Smith | Inspector | alexx@lsbd.org |
| Iris Pourciau | Administrative Coordinator--Licensing | iris@lsbd.org |
| Meg Isacks | Administrative Coordinator--front desk | meg@lsbd.org |

### seed.ts Data:

| Name | Title | Email |
|------|-------|-------|
| Arthur B. Hickham, Jr., D.D.S. | Executive Director | art@lsbd.org |
| Erin Connor | Assistant Executive Director | erin@lsbd.org |
| Ashleigh Daniel | Administrative Assistant | ashleigh@lsbd.org |
| Breanna Isacks | Administrative Assistant | breanna@lsbd.org |
| Charlotte Pourciau | Investigator | charlotte@lsbd.org |
| Frances Smith, R.D.H. | CE Coordinator | frances@lsbd.org |

### mock-data.ts Data:

| Name | Title | Email |
|------|-------|-------|
| Arthur Hickham | Executive Director | ahickham@lsbd.org |
| Leah Hebert | Director of Licensing | lhebert@lsbd.org |
| Jennifer Perez | Administrative Coordinator | jperez@lsbd.org |
| Monica Boudreaux | Investigator | mboudreaux@lsbd.org |

### Detailed Comparison:

| Staff | Current Site | seed.ts | mock-data.ts | Status |
|-------|-------------|---------|--------------|--------|
| Executive Director | Arthur F. Hickham, Jr. / ahickham@lsbd.org | Arthur B. Hickham, Jr., D.D.S. / art@lsbd.org | Arthur Hickham / ahickham@lsbd.org | WRONG in seed.ts: middle initial is "F." not "B.", email is ahickham@ not art@. mock-data.ts has correct email but shortened name. |
| Asst. Exec. Director | Erin Conner / erin@lsbd.org | Erin Connor / erin@lsbd.org | (not listed) | WRONG in seed.ts: last name is "Conner" not "Connor". Email is correct. |
| Admin Assistant | Rachel Daniel / rachel@lsbd.org | Ashleigh Daniel / ashleigh@lsbd.org | (not listed) | WRONG in seed.ts: first name is "Rachel" not "Ashleigh", email is rachel@ not ashleigh@. |
| Inspector | Alexx Smith / alexx@lsbd.org | (no match) | (not listed) | MISSING/WRONG. seed.ts has "Charlotte Pourciau / Investigator" and "Frances Smith, R.D.H. / CE Coordinator" -- neither matches. |
| Admin Coord (Licensing) | Iris Pourciau / iris@lsbd.org | (no match) | (not listed) | MISSING from seed.ts and mock-data.ts entirely. |
| Admin Coord (Front Desk) | Meg Isacks / meg@lsbd.org | Breanna Isacks / breanna@lsbd.org | (not listed) | WRONG in seed.ts: first name is "Meg" not "Breanna", email is meg@ not breanna@. |
| Director of Licensing | (not on current site) | (not listed) | Leah Hebert / lhebert@lsbd.org | WRONG in mock-data.ts: this person/position doesn't appear on the current site. |
| Admin Coordinator | (not on current site as listed) | (not listed) | Jennifer Perez / jperez@lsbd.org | WRONG in mock-data.ts: this person doesn't appear on the current site. |
| Investigator | (not on current site) | Charlotte Pourciau / charlotte@lsbd.org | Monica Boudreaux / mboudreaux@lsbd.org | WRONG in both: neither person appears. Current site has Alexx Smith as Inspector. |

| Item | Status | Details |
|------|--------|---------|
| seed.ts staff | WRONG | Every staff member has errors in name and/or email. Several fabricated staff. |
| mock-data.ts staff | WRONG | 3 of 4 staff are entirely fabricated names not on current site. |
| seed.ts admin user email | CORRECT | erin@lsbd.org matches current Asst. Exec. Director. |
| seed.ts Erin last name | WRONG | Should be "Conner" not "Connor" (per current site spelling). |

---

## 3. Fee Schedule

### Current Site (lsbd.org/fees.htm):

**DENTIST FEES:**
| Fee | Amount |
|-----|--------|
| License by examination | $350 |
| License by credentials | $2,050 |
| Biennial license renewal fee | $590 |
| Personal nitrous permit | $50 |
| Personal nitrous permit renewal | $50 |
| Personal/office moderate sedation or general anesthesia permit | $400 |
| Personal moderate sedation or general anesthesia permit renewal | $200 |

**HYGIENIST FEES:**
| Fee | Amount |
|-----|--------|
| License by examination | $180 |
| License by credentials | $830 |
| Biennial license renewal fee | $230 |
| Nitrous permit | $50 |
| Local anesthesia permit | $50 |

**MISCELLANEOUS FEES:**
| Fee | Amount |
|-----|--------|
| EDDA certification confirmation | $100 |
| Official list of all dentists or hygienists | $500 |
| Up to 1/2 of official list | $250 |

### seed.ts Fees (amounts stored in cents):

| Fee | seed.ts Amount | Current Site | Status |
|-----|---------------|--------------|--------|
| Dentist LBE | $350 | $350 | CORRECT |
| Dentist LBC | $2,050 | $2,050 | CORRECT |
| Dentist LA Resident LBC | $2,050 | (not listed separately) | UNVERIFIED - not a separate fee on current site |
| Dentist Annual Renewal | $275 | **$590 (BIENNIAL)** | WRONG - Current site says "Biennial" at $590, not "Annual" at $275. Even if you divide $590/2 = $295, it doesn't equal $275. The terminology is also wrong (annual vs biennial). |
| Dentist Late Renewal Penalty | $150 | (not listed on fee page) | UNVERIFIED - no late fee listed on current fee page |
| Hygienist LBE | $180 | $180 | CORRECT |
| Hygienist LBC | $830 | $830 | CORRECT |
| Hygienist LA Resident LBC | $830 | (not listed separately) | UNVERIFIED |
| Hygienist Annual Renewal | $150 | **$230 (BIENNIAL)** | WRONG - Current site says "Biennial" at $230, not "Annual" at $150. |
| Hygienist Late Renewal Penalty | $100 | (not listed on fee page) | UNVERIFIED |
| Duplicate License | $50 | (not listed) | UNVERIFIED |
| License Verification | $25 | (not listed) | UNVERIFIED |
| Anesthesia Permit Application | $250 | **$400 (initial) / $200 (renewal)** | WRONG - Current site has separate initial ($400) and renewal ($200) for sedation/GA. Our seed.ts has a single generic $250 entry. |

### mock-data.ts Fees:

| Fee | mock-data.ts Amount | Current Site | Status |
|-----|---------------------|--------------|--------|
| Dentist LBE | $300 | $350 | WRONG - Should be $350 |
| Dentist LBC | $500 | $2,050 | WRONG - Should be $2,050 |
| Dentist Annual Renewal | $275 | $590 biennial | WRONG - See above |
| Dentist Late Renewal | $150 | (not listed) | UNVERIFIED |
| Dentist Reinstatement | $500 | (not listed) | UNVERIFIED |
| Dentist Volunteer License | $0 | (not listed) | UNVERIFIED |
| Dentist Duplicate License | $25 | (not listed) | UNVERIFIED |
| Dentist GA Permit | $300 | $400 | WRONG - Should be $400 |
| Dentist Sedation Permit | $300 | $400 | WRONG - Should be $400 |
| Hygienist LBE | $150 | $180 | WRONG - Should be $180 |
| Hygienist LBC | $250 | $830 | WRONG - Should be $830 |
| Hygienist Annual Renewal | $150 | $230 biennial | WRONG |
| Hygienist Late Renewal | $100 | (not listed) | UNVERIFIED |
| Hygienist Reinstatement | $250 | (not listed) | UNVERIFIED |
| Hygienist Local Anesthesia Permit | $50 | $50 | CORRECT |
| Hygienist Nitrous Oxide Permit | $50 | $50 | CORRECT |
| Verification Letter | $25 | (not listed) | UNVERIFIED |
| Certified Copy | $25 | (not listed) | UNVERIFIED |
| Returned Check Fee | $50 | (not listed) | UNVERIFIED |

### Critical Fee Issues:

| Issue | Status | Details |
|-------|--------|---------|
| Renewal terminology | WRONG | Current site says "BIENNIAL" renewal. Our code says "Annual" everywhere. This is a fundamental structural error. |
| Dentist biennial renewal | WRONG | Should be $590 biennial, not $275 annual |
| Hygienist biennial renewal | WRONG | Should be $230 biennial, not $150 annual |
| Dentist LBE (mock-data) | WRONG | $300 should be $350 |
| Dentist LBC (mock-data) | WRONG | $500 should be $2,050 |
| Dentist GA/Sedation permit (mock-data) | WRONG | $300 should be $400 |
| Hygienist LBE (mock-data) | WRONG | $150 should be $180 |
| Hygienist LBC (mock-data) | WRONG | $250 should be $830 |
| Missing fees | WRONG | Current site lists EDDA confirmation ($100), Official list ($500/$250), personal nitrous ($50/$50), but our data doesn't include these |
| Fabricated fees | UNVERIFIED | Our data includes reinstatement, volunteer, duplicate license, returned check fees not listed on current site |

---

## 4. Contact Information

### Current Site:

| Item | Current Site Value |
|------|-------------------|
| Phone | (225) 219-7330 |
| Fax | (225) 219-0707 |
| Mailing Address | P.O. Box 5256, Baton Rouge, LA 70821-5256 |
| Physical Address | 18212 East Petroleum Dr., Suite 2-B, Baton Rouge, LA 70809 |

### constants.ts:

| Item | Our Value | Status |
|------|-----------|--------|
| Phone | 225-219-7330 | CORRECT |
| Mailing Address | P.O. Box 5256, Baton Rouge, Louisiana 70821-5256 | CORRECT (format differs slightly: "Louisiana" vs "LA") |
| Physical Address | 18212 East Petroleum Drive, Suite 2-B, Baton Rouge, Louisiana 70809 | CORRECT (uses "Drive" vs "Dr." and "Louisiana" vs "LA" -- acceptable) |
| Email | admin@lsbd.org | UNVERIFIED - Current site does not show a generic "admin@lsbd.org" email. Individual staff emails are used instead. |
| Fax | (not listed) | MISSING - Current site shows fax (225) 219-0707 but it's not in our constants. |

---

## 5. Continuing Education Requirements

### Current Site (lsbd.org/conted.htm):

The CE page does **not** explicitly state total CE hours for dentists or hygienists. It references "Chapter 16 of Board Rules" for the specifics. Key details found:

- CE reporting deadline: December 31 via CE Broker
- Free CE Broker Basic account for all licensees
- BLS: Required for all licensees, counts as 3 personally attended clinical hours
- BLS approved providers: American Heart Association BLS Provider or American Red Cross BLS
- Online-only BLS: NEVER accepted
- ACLS: Required for adult moderate sedation or GA permit holders
- PALS: Required for pediatric moderate sedation permit holders
- Opioid Management: **Dentists only**, 3 hours, **ONE-TIME requirement** (starting 2018 renewals)
- Opioid exemption: Available via notarized affidavit (for non-prescribers of controlled substances)
- Anesthesia CE: 6 hours per renewal cycle for sedation/GA permit holders

### Our Dentist CE Page (`dentists/continuing-ed/page.tsx`):

| Item | Our Site | Current Site | Status |
|------|----------|-------------|--------|
| Total CE hours | 20 hours per calendar year | Not explicitly stated on the CE page | UNVERIFIED - 20 hours is a commonly cited figure but the site references Board Rules Chapter 16 |
| Reporting period | January 1 - December 31 | December 31 deadline | CORRECT (consistent) |
| BLS required | Yes, for all licensees | Yes, for all licensees | CORRECT |
| BLS providers | AHA, ARC, "or equivalent" | AHA BLS Provider, ARC BLS only | WRONG - Current site does NOT say "or equivalent." Only AHA and ARC. |
| Opioid requirement | 3 hours **annually** | 3 hours **ONE-TIME** | WRONG - This is a critical error. The current site explicitly says it's a one-time requirement, not annual. Our site says "annually." |
| Opioid applies to | Dentists (implied for hygienists too in mock-data) | **Dentists only** | WRONG in hygienist CE page - We show opioid requirement for hygienists too, but the current site says "Dentists only." |
| ACLS/PALS | Required for GA/sedation permit holders | Required for GA/sedation permit holders | CORRECT |
| CE Broker | Free Basic account | Free Basic account | CORRECT |
| Carryover | No carryover | Not stated | UNVERIFIED |

### Our Hygienist CE Page (`hygienists/continuing-ed/page.tsx`):

| Item | Our Site | Current Site | Status |
|------|----------|-------------|--------|
| Total CE hours | 12 hours per calendar year | Not explicitly stated on CE page | UNVERIFIED |
| Opioid requirement | 3 hours annually | **NOT required for hygienists** | WRONG - Current site says opioid CE is "Dentists only." Our hygienist CE page incorrectly lists this requirement. |
| BLS providers | AHA, ARC, "or equivalent" | AHA, ARC only | WRONG - Should not say "or equivalent" |

### Mock Data Alerts:

| Item | mock-data.ts | Current Site | Status |
|------|-------------|-------------|--------|
| Opioid CE alert | "all dentists and dental hygienists must complete three (3) hours of opioid management" | Dentists only, one-time | WRONG - Hygienists are NOT required. Also it's one-time, not ongoing. |

---

## 6. Renewal Information

### Current Site (lsbd.org/renewals.htm):

- **License expiration:** December 31, 2025
- **Online renewals: DISCONTINUED** -- Paper only (checks/money orders)
- **Renewal cycle: BIENNIAL** (per fee page)
- **Login portals still listed:** dentist and hygienist membersbase.com URLs (for other functions, not renewal)
- **Late fee:** Required after December 31 but specific amount not stated on renewal page
- **Anesthesia CE:** 6 hours per renewal cycle for sedation/GA permit holders
- **Contact for exemptions:** iris@lsbd.org

### Our Dentist Renewal Page (`dentists/renewal/page.tsx`):

| Item | Our Site | Current Site | Status |
|------|----------|-------------|--------|
| Renewal frequency | "Annual" (December 31 each year) | **BIENNIAL** | WRONG - Renewal is biennial, not annual |
| Renewal method | "Renew online through the licensee portal" | **Paper only -- online discontinued** | WRONG - Online renewals have been discontinued. Our site prominently promotes online renewal. |
| Renewal fee | $275.00 | $590 (biennial) | WRONG |
| Late fee | $150.00 (after Dec 31) | Not specified on renewal page | UNVERIFIED |
| Final deadline | March 31 | Not specified | UNVERIFIED |
| Renewal period opens | October 1 | Not specified | UNVERIFIED |
| CE checklist: 20 hours CE | Listed | Not confirmed on renewal page | UNVERIFIED |
| CE checklist: Malpractice insurance | Listed as requirement | Not mentioned on current site | UNVERIFIED - may be fabricated |
| CE checklist: 3 hours opioid | Listed as annual | One-time only for dentists | WRONG |

### Our Hygienist Renewal Page (`hygienists/renewal/page.tsx`):

| Item | Our Site | Current Site | Status |
|------|----------|-------------|--------|
| Renewal frequency | "Annual" | **BIENNIAL** | WRONG |
| Renewal method | "Renew online" | **Paper only** | WRONG |
| Renewal fee | $150.00 | $230 (biennial) | WRONG |
| Late fee | $100.00 | Not specified | UNVERIFIED |
| CE checklist: 12 hours CE | Listed | Not confirmed | UNVERIFIED |
| CE checklist: 3 hours opioid | Listed | **Dentists only** | WRONG - Opioid CE not required for hygienists |

---

## 7. Licensure Requirements

### Current Site (lsbd.org/licenseinfo.htm):

**Dentist LBE:**
- ADEX exam within 5 years of applying
- Criminal fingerprint background check required
- Contact: Iris Pourciau (iris@lsbd.org)

**Dentist LBC:**
- Currently licensed in another state
- Practiced 1,000+ hours/year for preceding 3 years
- Contact: Alexx Smith (alexx@lsbd.org)

**Louisiana Resident Dental LBC:**
- Current Louisiana residency
- License in good standing in another state for at least 1 year
- Passed clinical exam with hand skills assessment

**Hygienist LBE:**
- ADEX within 3 years of applying
- Contact: Iris Pourciau (iris@lsbd.org)

**Hygienist LBC:**
- Licensed in another state
- 1,000+ hours practice in preceding 1 year
- Contact: Alexx Smith (alexx@lsbd.org)

### Our Dentist Licensure Page (`dentists/licensure/page.tsx`):

| Item | Our Site | Current Site | Status |
|------|----------|-------------|--------|
| LBE - CODA graduation | Listed | Not explicitly stated (implied) | CORRECT (standard requirement) |
| LBE - NBDE/INBDE | Listed | Not explicitly stated on info page | UNVERIFIED |
| LBE - Regional exam (ADEX, CRDTS, SRTA, WREB) | Listed | ADEX mentioned; "within 5 years" | PARTIALLY CORRECT - ADEX confirmed; other exams not mentioned |
| LBE - BLS | Listed | Not on licensure page | UNVERIFIED |
| LBE - Jurisprudence exam | Listed | Not mentioned | UNVERIFIED |
| LBE - Application fee: $300 | Listed as $300 | **$350** | WRONG - Should be $350 per fee page |
| LBC - 5 years active practice | Listed | **3 years at 1,000 hours/year** | WRONG - Current site says 3 years, not 5 |
| LBC - No disciplinary actions | Listed | Not explicitly stated | UNVERIFIED |
| LBC - Application fee: $500 | Listed as $500 | **$2,050** | WRONG - Should be $2,050 per fee page |
| Criminal background check | Not mentioned | **Required** | MISSING - Background check is a key requirement |
| ADEX time limit | Not mentioned | **5 years** for dentists | MISSING |
| Contact for LBE | admin@lsbd.org | **iris@lsbd.org** | WRONG |
| Contact for LBC | admin@lsbd.org | **alexx@lsbd.org** | WRONG |

### Our Hygienist Licensure Page (`hygienists/licensure/page.tsx`):

| Item | Our Site | Current Site | Status |
|------|----------|-------------|--------|
| LBE - CODA hygiene program | Listed | Implied | CORRECT |
| LBE - NBDHE | Listed | Not stated on page | UNVERIFIED |
| LBE - Regional exam | Listed | ADEX within 3 years | PARTIALLY CORRECT |
| LBE - Application fee: $150 | Listed as $150 | **$180** | WRONG - Should be $180 per fee page |
| LBC - 3 years active practice | Listed | **1 year at 1,000+ hours** | WRONG - Current site says 1 year, not 3 |
| LBC - Application fee: $250 | Listed as $250 | **$830** | WRONG - Should be $830 per fee page |
| Criminal background check | Not mentioned | **Required** | MISSING |
| ADEX time limit | Not mentioned | **3 years** for hygienists | MISSING |

---

## 8. External Links

### constants.ts Links:

| Link | Our URL | Current Site | Status |
|------|---------|-------------|--------|
| Dentist Login | https://www.membersbase.com/lsbd/dentist | https://www.membersbase.com/lsbd/dentist | CORRECT |
| Hygienist Login | https://www.membersbase.com/lsbd/hygienist | https://www.membersbase.com/lsbd/hygienist | CORRECT |
| License Verification | https://www.member-base.net/lsbdweb/licenseverification.htm | https://www.member-base.net/lsbdweb/licenseverification.htm | CORRECT |
| CE Broker | https://www.cebroker.com/la/account_options | https://www.cebroker.com/la/account_options | CORRECT |
| Report Fraud | https://www.ReportFraud.La | http://www.ReportFraud.La (from current site) | CORRECT (protocol differs but same destination) |

---

## 9. Miscellaneous Issues

### Renewal Method Crisis
The current LSBD website explicitly states: **"Online license renewals are no longer available."** Renewals are paper-only by mail with check or money order. Our entire website is built around promoting online renewal through the licensee portal. This is a critical factual error that could confuse licensees.

### Annual vs. Biennial
The fee schedule on the current site says **"Biennial license renewal fee"** -- meaning every 2 years, not every year. Our website consistently uses "annual" terminology. All renewal pages, fee displays, and mock data need to be updated to say "biennial."

### Opioid CE: One-Time vs. Annual
The current site says opioid management CE is a **one-time** requirement for dentists only (starting 2018). Our site says it's an annual requirement for both dentists and hygienists. This is wrong on two counts.

### Missing Fees from Current Site
The current fee page lists items we don't have:
- EDDA certification confirmation: $100
- Official list of all dentists or hygienists: $500
- Up to 1/2 of official list: $250
- Personal nitrous permit (dentist): $50
- Personal nitrous permit renewal (dentist): $50
- Personal/office moderate sedation or GA permit: $400
- Personal moderate sedation or GA permit renewal: $200
- Hygienist nitrous permit: $50
- Hygienist local anesthesia permit: $50

### Fees We List That Aren't on Current Site
These fees appear in our data but are NOT on the current fee page:
- Duplicate License
- License Verification Letter
- Late Renewal Penalty
- License Reinstatement
- Volunteer License
- Returned Check Fee
- Certified Copy of Record

These may be valid fees listed elsewhere, but they cannot be verified from the current fee page.

---

## 10. Summary of Required Fixes

### CRITICAL (Factual Errors That Could Cause Real Harm):

1. **Board Members** -- Replace ALL board members in `seed.ts` and `mock-data.ts` with the current 15 members from lsbd.org/boardinfo.htm
2. **Staff Members** -- Replace ALL staff in `seed.ts` and `mock-data.ts` with the current 6 staff from lsbd.org/contactus.htm
3. **Renewal is BIENNIAL, not ANNUAL** -- Update all references across the entire codebase
4. **Online renewal is DISCONTINUED** -- Remove or update all "renew online" CTAs. Renewal is paper-only by mail.
5. **Dentist biennial renewal fee** -- Change from $275/year to $590/biennium
6. **Hygienist biennial renewal fee** -- Change from $150/year to $230/biennium
7. **Dentist LBE fee** -- Change from $300 (page) to $350
8. **Dentist LBC fee** -- Change from $500 (page) / $2,050 (seed) to $2,050
9. **Hygienist LBE fee** -- Change from $150 (page) to $180
10. **Hygienist LBC fee** -- Change from $250 (page) / $830 (seed) to $830
11. **Opioid CE is ONE-TIME for DENTISTS ONLY** -- Not annual, not for hygienists
12. **Dentist LBC requires 3 years (1,000 hrs/yr)** -- Not 5 years
13. **Hygienist LBC requires 1 year (1,000 hrs)** -- Not 3 years

### HIGH (Missing Required Information):

14. **Add fax number** (225) 219-0707 to constants.ts
15. **Add criminal background check** requirement to both licensure pages
16. **Add ADEX time limits** -- 5 years for dentists, 3 years for hygienists
17. **Add missing fee items** -- EDDA confirmation, official lists, nitrous/sedation permits with correct amounts
18. **Fix Erin's last name** -- "Conner" not "Connor" in seed.ts
19. **Fix Executive Director details** -- "Arthur F. Hickham, Jr." with email ahickham@lsbd.org (not "B." and not art@)
20. **Fix BLS provider language** -- Remove "or equivalent" -- only AHA and ARC are accepted

### MEDIUM (Cleanup and Consistency):

21. **Fix contact email** -- Individual staff emails are used (iris@lsbd.org for licensing, alexx@lsbd.org for LBC). "admin@lsbd.org" doesn't appear on the current site.
22. **Sedation/anesthesia permit fees** -- Need separate entries for initial ($400) vs renewal ($200)
23. **Remove fabricated mock-data.ts fees** that can't be verified (reinstatement, volunteer, returned check, etc.)
24. **Update mock-data.ts alert** about opioid CE -- currently wrong about both scope and frequency
25. **Add paper renewal application** download links (DentalRenewalPaper.pdf, HygieneRenewalPaper.pdf)
26. **Anesthesia CE requirement** -- Add 6 hours per renewal cycle for sedation/GA permit holders

### Verified Correct Items:

- Phone number: 225-219-7330
- Mailing address (content matches, format slightly different)
- Physical address (content matches)
- Dentist login URL
- Hygienist login URL
- License verification URL
- CE Broker URL
- Report Fraud URL
- Dentist LBE fee in seed.ts ($350)
- Hygienist LBE fee in seed.ts ($180)
- Hygienist LBC fee in seed.ts ($830)
- Hygienist local anesthesia permit ($50)
- Hygienist nitrous oxide permit ($50)
- BLS required for all licensees
- CE Broker free Basic account
- ACLS/PALS for sedation/GA permit holders

---

**End of Audit Report**

*This audit was performed by scraping the live lsbd.org website on February 25, 2026. The LSBD website may update at any time. All corrections should be verified against the live site before implementation.*
