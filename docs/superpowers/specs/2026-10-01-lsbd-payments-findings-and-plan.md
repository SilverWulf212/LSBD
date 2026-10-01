# LSBD Online Payments — Findings and Proposed Plan

> **Status:** DRAFT. These are findings and a *proposed* plan. They are not yet an approved design spec. D1 is decided (payments toggle); D2–D3 (§4b) gate the spec.
> **Date:** 2026-10-01
> **Parent spec:** `2026-09-30-lsbd-migration-cutover-design.md` (§2 decision table, §4.4 Payments, §9 risks)
> **Research detail:** `2026-10-01-payflow-research.md` (sources cited; unconfirmed items tagged)

## 1. Summary

- **Online renewals are live and large:** ~2,400–2,900 payments and **$1.0–1.2M per year**, about 75% of all renewals. They go through the current third-party portal (likely member-base.net), which writes `RefNum='ONLINE'` rows into the SQL Server database.
- **Renewal season runs Oct–Jan, and it started today.** The planned Nov 18–20 go-live lands right before the December peak (~1,700 payments in Dec 2025).
- **PayPal Payflow is still supported.** No PayPal sunset or forced migration was found. It is labeled "legacy", which is a real but undated risk.
- **Recommendation:**
  - Do **not** move payments during this renewal season. Keep member-base.net taking renewals through ~Jan 31 2027, with its rows synced into Supabase.
  - Launch the new Payflow checkout, tested end to end, for the next season.
  - Build the payment layer behind a small provider interface so Stripe can replace Payflow if needed.

## 2. Findings — what is paid online today

Source: aggregate queries on `lsbd_raw."tblTransactions"` (synced from LSBDDB), run 2026-10-01. No row-level data.

| Year | Online payments | Online $ | Other (paper/staff) |
|---|---|---|---|
| 2018 | 2,010 | $876,100 | 944 |
| 2019 | 2,760 | $1,219,870 | 1,200 |
| 2020 | 2,203 | $962,375 | 907 |
| 2021 | 2,703 | $1,176,380 | 868 |
| 2022 | 2,181 | $955,795 | 951 |
| 2023 | 2,595 | $1,132,130 | 827 |
| 2024 | 2,390 | $1,038,655 | 960 |
| 2025 | 2,865 | $1,244,980 | 646 |
| 2026 (to Oct 1) | 51 | $25,050 | 648 |

**Seasonality (online payments per month):**
- 2024-10: 391 · 2024-11: 376 · **2024-12: 1,362** · 2025-01: 46
- 2025-10: 573 · 2025-11: 523 · **2025-12: 1,723** · 2026-01: 44
- First Oct 2026 online payments: 6, as of today.

**What licensees pay online (since 2022):**

| Payments | Type | Description | Amount range |
|---|---|---|---|
| 4,932 | Hygienist | Renewal + wellbeing | $115–$230 |
| 3,422 | Dentist | Renewal + permit(s) + wellbeing | $345–$1,040 |
| 1,508 | Dentist | Renewal + wellbeing | $295–$590 |
| ~215 | D/H | Renewal + penalty (late) | $330–$1,240 |
| A handful | — | Reinstatement, registration | $100–$580 |

**Other facts:**
- The new site's renewal pages (`src/app/(public)/dentists/renewal/page.tsx`, the hygienists equivalent) say **"Online renewals discontinued"** and tell licensees to mail a check; they keep membersbase.com (`https://www.membersbase.com/lsbd/dentist` and `/hygienist`) only for verification and address changes. **This conflicts with the data:** 6 `ONLINE` renewals landed on 2026-10-01. Either the board has discontinued online renewals (so the copy is right and the ONLINE rows are stragglers), or the copy is wrong. Unconfirmed; ask Erin. Also note that VSAuth/VsCapture (card logs) were purged at the source on 2026-09-30.
- Fee composition is renewal + wellbeing fee + permit fee(s) + penalty, which maps onto `tblFees` / `lsbd.fees`, `tblTransSplits`, and `RenewalSettings`.
- The current online portal also captures renewal attestations: the `RenewalCertification` / `RenewalDetails` tables (37k rows) are fed by it. Payments and the renewal *application* are coupled.

## 3. Findings — PayPal Payflow (summary of research)

1. **Status:**
   - Docs were maintained through Sept 2026, with no deprecation banner.
   - The "Payflow ends Jan 2027" claim online is from X-Cart about its own plugin, not PayPal.
   - Payflow Link is labeled "legacy", and the old HTML-tag integration is "deprecated" (upgrade via PayPal Merchant Technical Support).
2. **Account type gates everything.** The PayPal Manager → Service Summary label decides what we can call:
   - "Payflow Link" (legacy) may need an upgrade before Secure Token is available.
   - "Hosted Checkout Pages & Payflow SDK/API (Limited Access)" can't run Sale via the API, only via hosted pages. That's fine for our flow.
3. **Flow:**
   1. The server calls `CREATESECURETOKEN=Y` at `payflowpro.paypal.com`. The amount is set server-side, so the browser can't tamper with it.
   2. The browser is redirected to `payflowlink.paypal.com`. The token lasts 30 min (design for 15), is one-time, and allows 3 submit attempts.
   3. The result arrives by Silent Post, server-to-server.
4. **Callbacks are not signed:**
   - Every result must be confirmed with an **Inquiry** (`TRXTYPE=I`) before a renewal is marked paid.
   - `RESULT=0` can still mean voided (`AVSDECLINED` / `CSCDECLINED`), with no second post.
   - A sweep of pending payments is needed. Inquiry by token works for 3 weeks.
5. **IP allowlist:** optional in Manager. If it is populated, calls from Vercel fail with RESULT=1 unless we buy Vercel Static IPs ($100/mo) or clear the list.
6. **PCI:**
   - Use the **full redirect (Layout A/B)**, not the iframe. That gives the lightest scope (SAQ A, inferred) and avoids the PCI DSS 4.0 script-integrity attestation for iframe pages.
   - Never store PAN or CVV. Store PNREF, RESULT, RESPMSG, AUTHCODE, AVS/CVV results, card type, last 4, and expiry.
7. **Refunds:** Void before daily settlement; Credit (`TRXTYPE=C`, `ORIGID`) after.
8. **Reconciliation:** the Reporting API (`payments-reports.paypal.com/reportingengine`) supports a nightly match on PNREF + amount.
9. **Stripe fallback:** signed webhooks, about $17 on a $590 renewal at list price, SAQ A, and less to build. It changes the merchant/bank relationship.

## 4. Decisions

**D1 — DECIDED 2026-10-01 (user):** member-base.net stays as a **backend-toggleable payment system**.
- **At go-live:** the site's renew/pay buttons link to member-base.net, exactly as today.
- **When the board says go:** an admin switch flips those buttons to our own payment system, which is already tested and working. The switch can flip back as a rollback path.
- **Implications for the design:**
  - **Payments mode flag** (`memberbase` | `lsbd`), stored in the DB.
    - It is changed only from `/admin` by the `admin` role, with an audit-log row on every flip.
    - It is read server-side by every renew/pay entry point, so no page hard-codes a member-base URL.
    - It takes effect immediately; no redeploy.
  - **Our system must be fully exercisable while the flag is `memberbase`.**
    - The pilot/test-mode path stays reachable by staff only (allowlist or role), for UAT and a live $1 test.
  - **While in `memberbase` mode after go-live:**
    - MSSQL stays up as member-base.net's data store. Its writes (transactions, splits, renewal certification/details, tblDenHyg renewal dates) must still reach Supabase, but **the current P1 sync engine cannot do this**: it must be stopped at cutover, because its transforms own `lsbd.*` (they delete rows not live in MSSQL and overwrite staff edits from MSSQL), and it impersonates `lsbdverify`, which the cutover disables.
    - **Required (P4 cutover blocker, cutover spec §11):** a separate *post-cutover payment-ingest mode*:
      - raw sync of the member-base payment tables only (`tblTransactions`, `tblTransSplits`, `RenewalCertification`, `RenewalDetails`, plus the tblDenHyg renewal-date fields),
      - an append/merge-only ingest into new-system tables: no deletes, no overwrites of staff-owned columns,
      - a dedicated read-only SQL user for the bridge (`db_datareader` + `db_denydatawriter`, created by Vincent), independent of `lsbdverify`,
      - and spec §7's `SET READ_ONLY` step reconciled with this decision (member-base.net must keep writing while the flag is `memberbase`).
    - **Open risk:** member-base.net also *reads* licensee data from MSSQL. After cutover, staff edits happen in Supabase, so member-base.net could see stale data (new licensees, status changes, fee changes).
    - Mitigation options, decided once we know what member-base.net reads:
      - (i) A narrow reverse feed (Supabase → MSSQL) of only the fields it reads. This needs an explicit lift of the "MSSQL read-only" rule for those tables.
      - (ii) Freeze those edits during the overlap.
      - (iii) Accept the staleness for the season.
  - **Flipping to `lsbd`:**
    - Renew/pay entry points go to `/pay/start`.
    - member-base.net is told to stop taking payments (or its link is simply no longer shown).
    - The post-cutover payment-ingest mode (above; not the P1 engine) continues until member-base.net's last writes have landed. Then the MSSQL write path is retired and credentials are rotated.

## 4b. Decisions still needed

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D2 | **How does a payer prove identity?** | (a) Verified checkout: license # + DOB or SSN-last-4, matched against `licensee_pii`. (b) Portal-first: account + TOTP, then pay. (c) Both, staged. | **(c).** Verified checkout first; logged-in portal users skip the challenge later. With D1(a), the portal could also simply come first. |
| D3 | **Processor** | (a) Payflow (current account). (b) Stripe Checkout. | **(a)**, *if* Manager checks pass (§5 step 1). Build behind a provider interface either way. |

## 5. Proposed plan (phased; becomes the spec + implementation plan once D1–D3 are decided)

**Phase 0 — Unblock and protect this season (this week; ~1 day of our time):**
1. **Fix the website copy.**
   - **Confirm with Erin whether online renewals are discontinued this season.** If they are not, replace the notice with a pointer to the membersbase.com renewal portal. If they are, the payments urgency drops and the toggle defaults to *mail-in only* until our checkout launches. Do not change the copy until this is confirmed.
   - Owner: us. ~30 min. Needs the correct current URL from Erin.
2. **Keep the ONLINE feed flowing.**
   - The sync already mirrors `tblTransactions`.
   - Add a cutover-plan item: after go-live, MSSQL stays up *only* as member-base.net's write target, and the sync keeps pulling `tblTransactions` / `tblTransSplits` / `RenewalCertification` / `RenewalDetails` until member-base.net is switched off (~Jan 31).
   - Owner: us (spec amendment + runbook).
3. **Ask Erin/Vincent:**
   - Who runs member-base.net, and what does it cost?
   - Exact renewal flow screens.
   - Payflow Manager login holder.
   - Merchant bank.
   - Any state rules on card convenience fees.

**Phase 1 — Payflow account checks (needs the Manager login; ~1 hour):**
1. Read the Service Summary label (legacy Link / Limited / Pro / Full).
2. Check Allowed IP Addresses (want: empty).
3. Confirm that Secure Token can be enabled, and that Test mode / pilot works.
4. Create a dedicated API user.
5. Open a written ticket with PayPal Merchant Technical Support about product lifecycle.
6. **Go/no-go for Payflow** (D3). On no-go, switch to the Stripe track. The interface is the same.

**Phase 2 — Payment core (~1.5–2 weeks of build):**
- **Data:** new `lsbd.payment_intent`, `lsbd.payment_attempt`, `lsbd.payment_event` (raw callback log, PAN-scrubbed), `lsbd.payment_result`.
  - Unique on PNREF and SECURETOKENID.
  - Money is `numeric(12,2)`.
  - On verified success, post `lsbd.transactions` + `transaction_splits` rows in the same shape as legacy `RefNum='ONLINE'`, so staff reports keep working.
- **Fee calculation:** server-side from `lsbd.fees` + `renewal_settings` + late-penalty rules (reproduce the Access `setFees` logic, from the parity inventory). Never accept an amount from the client.
- **Provider interface:** `createCheckout(intent) → redirect`, `verify(ref) → result`, `refund(pnref, amt)`, `reconcile(day)`. `PayflowProvider` first, with `StripeProvider` possible later.
- **Routes (Node runtime):**
  - `POST /api/pay/start` creates the intent and token, then redirects.
  - `POST /api/pay/payflow/silent-post` is idempotent: it Inquires, then records.
  - `GET|POST /pay/return` is display-only. It reads our DB, never the body.
  - `/pay/cancel`.
- **Jobs:**
  - A sweep every 5 min Inquires on pending intents older than 10 min.
  - A nightly reconcile pulls the Reporting API and matches PNREF + amount.
- **Security:**
  - Payflow creds go in Vercel sensitive env vars.
  - Per-attempt secret in `USER1` and the return URL.
  - CSP `form-action https://payflowlink.paypal.com`.
  - No PII in COMMENT/USER fields.
  - Rate-limit the callbacks.
- **Tests:**
  - Unit: fee calculation and the result parser, including the AVSDECLINED-with-RESULT=0 case.
  - Integration: against the pilot (`pilot-payflowpro` / `pilot-payflowlink`) with test card 4111…1111.
  - Idempotency: double silent post, out-of-order return.

**Phase 3 — Renewal application + payer identity (with the portal; ~2 weeks, overlaps the portal plan):**
- Renewal form and attestations, replacing `RenewalCertification` / `RenewalDetails` capture.
- Verified checkout (D2) and/or portal login.
- Receipt email.
- Staff `/admin` views: payments list, refund (role-gated: finance), and a reconciliation report.

**Phase 4 — Pilot and launch for next season:**
1. UAT with staff on pilot.
2. One live $1 test payment, then void it.
3. Run in parallel with member-base.net for a short window, then switch the website link.
4. Turn off member-base.net and retire the MSSQL write path.
5. Rotate credentials.

**Out of scope here:** storing cards, auto-renew/recurring billing, ACH (Payflow ACH is unavailable to new accounts), and historical Payflow card logs (VSAuth/VsCapture — purged, never re-import).

## 6. Risks

| Risk | Mitigation |
|---|---|
| PayPal announces a Payflow sunset | Provider interface; Stripe track documented; written PayPal ticket. |
| Account is legacy Link / IP-allowlisted | Phase 1 checks before any build; PayPal upgrade or Vercel Static IPs ($100/mo). |
| Paid at PayPal but not recorded (no callback) | Inquiry sweep + nightly Reporting-API reconcile. |
| Forged callback | Never trust the body; always Inquire; per-attempt secret. |
| Wrong fee charged | Server-side fee engine with tests reproducing Access `setFees`; staff UAT against known cases. |
| member-base.net writes after MSSQL retirement | D1(a) + keep the sync on the payment tables until member-base.net is off. |

## 7. Next actions

1. **User:** D1 decided (payments toggle). Decide D2–D3, or confirm the recommendations.
2. **Erin/Vincent:** the Phase 0 step 3 questions plus the Payflow Manager login, for the Phase 1 checks.
3. **Us, after the decisions:** turn §5 into the approved payments design spec, then the implementation plan (writing-plans), then build via subagent-driven development.
