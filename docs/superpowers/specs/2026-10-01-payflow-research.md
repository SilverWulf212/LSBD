# Payflow research for LSBD online renewals (as of 2026-10-01)

Method: PayPal developer docs fetched 2026-10-01 (pages show "last updated" Aug 11-17 2026; revision history shows Sept 14 2026), plus the PayPal Payflow Link User's Guide PDF (May 2012) and a few third-party sources where PayPal docs were silent. Anything I could not confirm from a PayPal source is tagged **[UNCONFIRMED]**. Quotes are from fetched page text, which was summarised by a fetch tool in most cases, so verify exact parameter wording against the live page before coding.

---

## 0. Bottom line

- **No official PayPal end-of-sale, end-of-life, TLS, endpoint or forced-migration notice for Payflow Pro / Payflow Gateway was found in PayPal's own 2026 docs.** The developer docs are being actively maintained (pages updated Aug 17 2026; revision history last touched Sept 14 2026), carry no deprecation banner, and the newest listed deprecations are old (Buyer Authentication/Account Monitoring and 3-D Secure 1.x in 2022-2023).
- **Do NOT repeat the "Payflow Link will be discontinued in 2026, processing ending January 2027" claim.** It shows up in search-engine summaries, but I traced it to a banner on X-Cart's own help page ("This PayPal payment method will be discontinued in 2026, with processing ending in January 2027. Switch to the latest PayPal add-on or use PayPal through X-Payments.") on an X-Cart article about X-Cart's legacy PayPal API v1 modules (https://support.x-cart.com/en/articles/4506883-deprecated-paypal-solutions-overview-api-v1). That is X-Cart retiring its own module, not PayPal retiring the gateway. Likewise Chargebee and Event Espresso say "Payflow Pro is deprecated" about *their* connectors. Nothing from PayPal supports a Jan 2027 date. Note this coincides with LSBD's own Jan 2027 hard deadline, so it is easy to conflate.
- **There IS a genuine soft-deprecation signal:** PayPal's docs call the *legacy Payflow Link HTML-input-tag integration* "deprecated" and tell merchants to get their account upgraded to the "new version of Payflow" via Merchant Technical Support (https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/payflow-link-migration/). The overview page also labels Payflow Link "(legacy)" (https://developer.paypal.com/api/nvp-soap/payflow/payflow-gateway/), and the "Payflow Gateway and PayPal Payments Pro" page says Website Payments Pro and Website Payments Pro Payflow Edition are "no longer actively marketed" (https://developer.paypal.com/api/nvp-soap/payflow). Whether PayPal still onboards *new* Payflow merchants: **[UNCONFIRMED]** (Chargebee says new onboarding is gone on their side only).
- **Biggest practical risk is not a sunset date; it is (a) which account type LSBD actually has, and (b) the Vercel egress-IP problem.** Both are covered below. Also "PayPal could announce a sunset at any time on a product the docs themselves call legacy" is a real, undated strategic risk for a system meant to run for 10+ years.

---

## 1. Product status (detail)

| Item | Finding | Source |
|---|---|---|
| Docs are live and current | Developer guide "Last Updated: August 17, 2026"; revision history last entry Sept 14 2026; no deprecation banner on the guide | https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/ , https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/reference/revision-history/ |
| Product family | Payflow Gateway = Payflow Link (PayPal-hosted, "legacy" label), Payflow Pro (merchant-hosted), PayPal Payments Pro. Available US, Canada, Australia, New Zealand | https://developer.paypal.com/api/nvp-soap/payflow/payflow-gateway/ |
| Hosted pages supported on all four products (PPA, Link, Pro, PPP) | Table says "Yes" for each; PayPal "recommends secure token and the hosted checkout pages" for PCI. Page last updated Aug 17 2026, "no sunset dates" | https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/gateway-checkout-solutions |
| Legacy vs new account levels | Manager Service Summary shows "Payflow Link" (legacy), "Hosted Checkout Pages & Payflow SDK/API (Limited Access)" (new Link), "Payflow Pro" (legacy), "Hosted Checkout Pages & Payflow SDK/API (Full Access)" (new Pro). "Limited Access" = most API functions but cannot run Sale/Authorization via the API; must use hosted pages for those | https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/ |
| Legacy Payflow Link HTML-tag integration | "now deprecated"; account upgrade requested via PayPal Merchant Technical Support; legacy integration keeps working after upgrade; parameter map (CARDNUM to ACCT, AMOUNT to AMT, TYPE to TRXTYPE, LOGIN to VENDOR, etc.) | https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/payflow-link-migration/ |
| Past deprecations in revision history | Buyer Authentication + Account Monitoring removed (Jan 2023), 3-DS v1 deprecated Oct 14 2022, ACH unavailable to new accounts (May 2021), FISERV South deprecated (May 2021), some legacy processors removed; advice to use host names, not hard-coded IPs (Apr 2020) | revision-history URL above |
| Forced migration to Braintree / "PayPal Complete Payments" | **No PayPal source found.** Searches returned nothing from PayPal; **[UNCONFIRMED]** either way | n/a |
| TLS / endpoint changes | None in revision history. Historical: TLS 1.2 + HTTP/1.1 mandatory since 2018-04-30 and SHA-256 certs (PayPal TLS-update repo; secondary summary) | https://github.com/paypal/TLS-update (not fetched directly; from search result) |

**Action item that gates everything:** log into PayPal Manager and read the Service Summary label. If it says plain "Payflow Link", the merchant is on the legacy HTML-tag product and secure tokens via `CREATESECURETOKEN` may not be available until PayPal MTS upgrades the account. Ask PayPal MTS explicitly (a) which service level the account is, (b) whether the account is open to new Payflow features, (c) whether any retirement is planned (get it in writing), (d) whether the existing merchant account is a PayPal-processed one or a bank/IMA with a processor (affects Payflow Pro vs Payments Advanced and fees).

---

## 2. Secure Token flow end to end

Correction to the brief: the request parameter is **`CREATESECURETOKEN=Y`**, not "CREATETOKEN".

### 2.1 Create the token (server to server)

- POST (name-value pairs) to `https://payflowpro.paypal.com` (live) / `https://pilot-payflowpro.paypal.com` (test). Source: https://developer.paypal.com/api/nvp-soap/payflow/payflow-pro/payflow-pro-credentials , https://developer.paypal.com/api/nvp-soap/payflow/gs-ppa-hosted-pages/
- Credentials: `PARTNER` (usually `PayPal`, or reseller ID), `VENDOR` (merchant login), `USER` (mandatory in API calls; same as VENDOR if no extra users), `PWD`. Create a dedicated API user (role `API_FULL_TRANSACTIONS` is recommended for API integrations: no password expiry; `FULL_TRANSACTIONS` is what the hosted-pages quick start uses). Source: credentials page above.
- Example from PayPal: `TRXTYPE=A&BILLTOSTREET=123 Main St.&BILLTOZIP=95131&AMT=23.45&CURRENCY=USD&INVNUM=INV12345&CREATESECURETOKEN=Y&SECURETOKENID=9a9ea8208de1413abc3d60c86cb1f4c5`
  Response: `RESULT=0&RESPMSG=Approved&SECURETOKEN=...&SECURETOKENID=...` Source: https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/secure-token/
- **SECURETOKENID:** unique, merchant-generated, alphanumeric, up to 36 characters. Use a UUID without dashes (32 hex) generated server-side; store it against the renewal/invoice row. Source: secure-token page. (The doc says "unique"; whether uniqueness is per-vendor-forever or per-time-window **[UNCONFIRMED]**. Never reuse one.)
- **SECURETOKEN:** up to 32 alphanumeric chars per the doc summary (the example shows a longer base64-looking string with `[25]` length tag, so treat as opaque and URL-encode it). One-time use.
- **Lifetime:** **30 minutes** per the current developer docs (secure-token page, gs-ppa-hosted-pages, revision history "clarified as 30 minutes"). The old PayPal Manager help page says 15 minutes (https://www.paypalobjects.com/en_US/vhelp/paypalmanager_help/setup.htm); treat 30 as current but design for 15. Use after expiry fails (docs: RESULT 7 in one place; error 162 "expired" in another, see 2.5).
- **Retries:** a failed attempt may be retried; the token expires after being submitted a total of 3 times (secure-token page).
- **TRXTYPE:** `S` (sale, flagged for settlement) is what PayPal's quick start uses. `A` (authorization) then `D` (delayed capture) only makes sense if you want to hold funds before fulfilment; for a licence renewal where the board approves after payment, `S` plus void/credit if needed is simpler. Note that capture/void/credit are API calls using `ORIGID`. On Limited Access (new Payflow Link) accounts, S/A cannot be run via the API directly, only via hosted pages (integration-guide page above). **[UNCONFIRMED]** whether `CREATESECURETOKEN` with `TRXTYPE=S` is permitted on a Limited Access account; PayPal's own flow implies yes, but test in the pilot environment with the real account.
- **AMT:** decimal format "34.00" (not "34") (https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/submit-transactions). Because the token stores the data server-side, the browser cannot tamper with the amount (secure-token page: "preventing anyone from intercepting or manipulating the data"). This is the key anti-tampering property; always compute the fee on the server (renewal fee + late fee from your DB), never from a form field.
- **INVNUM** (invoice number, up to 9 chars is the classic Payflow limit **[UNCONFIRMED in fetched text; check]**), **CUSTREF** (merchant-defined id for reporting/audit; can be used for Inquiry with optional STARTTIME/ENDTIME), **COMMENT1/COMMENT2**, **USER1..USER10** pass-through fields (not shown to the customer). Source for CUSTREF/inquiry: submit-transactions page. Recommended: `CUSTREF` = your renewal payment UUID (this is the lookup key), `INVNUM` = short human invoice number, `COMMENT1` = licence number + type, no PII beyond that. Max lengths **[UNCONFIRMED]**; see the parameter tables in the integration guide.
- **BILLTO fields:** `BILLTOFIRSTNAME`, `BILLTOLASTNAME`, `BILLTOSTREET`, `BILLTOCITY`, `BILLTOSTATE`, `BILLTOZIP`, `BILLTOCOUNTRY`, `BILLTOEMAIL`, etc. Pass `BILLTOSTREET` and `BILLTOZIP` if you want AVS to be meaningful (example in secure-token page includes them). The cardholder can still edit on the hosted page depending on Manager settings **[UNCONFIRMED exact behaviour]**.
- **Hosted-page display parameters** can be sent with the token request or posted to the hosted page, and override Manager settings: `TEMPLATE`, colour params (`PAGECOLLAPSEBGCOLOR`, `PAGEBUTTONBGCOLOR`, `LABELTEXTCOLOR`, ...), `CSCREQUIRED`/`CSCEDIT`, `RETURNURL`, `CANCELURL`, `ERRORURL`, `SILENTPOSTURL` (each max 512 chars). Source: https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/configure-hosted-checkout
- **Header for idempotent retries of the CREATE call:** `PAYFLOW-REQUEST-ID` helps prevent duplicate transactions on retry (transaction-responses page: https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/transaction-responses). RESULT 30 = duplicate transaction.

### 2.2 Send the customer to the hosted page

- Hosted page host: `https://payflowlink.paypal.com` (live), `https://pilot-payflowlink.paypal.com` (test). Source: configure-hosted-checkout and test-hosted-pages (https://developer.paypal.com/api/nvp-soap/payflow/test-hosted-pages/).
- Two ways: (a) an HTTP form POST of `SECURETOKEN`, `SECURETOKENID`, and `MODE=TEST|LIVE` to that URL (redirect); or (b) an `<iframe src="https://payflowlink.paypal.com?MODE=LIVE&SECURETOKENID=...&SECURETOKEN=...">` (gs-ppa-hosted-pages; example 570x540). `MODE` must be `TEST` when using the pilot host (test-hosted-pages tip).
- **Layouts** (configure-hosted-checkout):
  - Layout A (default) and Layout B: full-page redirect templates; desktop templates that auto-detect mobile and redirect to mobile-optimised pages.
  - Layout C: embedded in an iframe on a page you host; you handle mobile detection. `TEMPLATE=MINLAYOUT` (default for C) or `TEMPLATE=MOBILE`; `TEMPLATE=TEMPLATEA` / `TEMPLATEB` for the redirect layouts. Mobile customisations set in Manager do not apply to mobile pages.
  - For Layout C iframes PayPal says to add sandbox permissions `allow-top-navigation allow-scripts allow-same-origin allow-forms allow-modals`.
  - Layout C ignores `CANCELURL` unless prefixed `DISPLAY_URL |` (as documented).
- **RETURNURL / CANCELURL / ERRORURL:** 512 chars each. RETURNURL return method is configured in Manager as `LINK` (browser returns, no data) or `POST` (browser returns with transaction data posted) (Manager Setup help). Allowed-domain restrictions for these URLs **[UNCONFIRMED]**; I found none documented.
- **Recommended for us:** use the redirect layout (A or B) rather than Layout C iframe, for PCI reasons (section 6) and because the iframe + RETURNURL top-level-navigation interplay is not documented. **[UNCONFIRMED]**: how RETURNURL behaves from inside the C iframe (not in fetched docs; sandbox flag `allow-top-navigation` implies it breaks out of the frame).

### 2.3 Silent Post

- Enable in Manager: Hosted Checkout Pages > Set Up > "Use Silent Post"; supply the Silent Post URL, or pass `SILENTPOSTURL` per token (512 chars). Source: configure-hosted-checkout; Manager Setup help page (https://www.paypalobjects.com/en_US/vhelp/paypalmanager_help/setup.htm).
- It is a server-to-server HTML form POST (name=value pairs, `&`-separated) sent "in the background... ensuring data transfer even if buyers close browsers early".
- **Force Silent Post Confirmation** ("Void transaction when my server fails to receive data"): PayPal sends the post and waits for an HTTP **200**; if it does not get one, the transaction is voided and the customer sees an error; Manager then shows both the sale and the void. A "Failed Silent Post Return URL" can be set. Sources: Manager Setup help; Payflow Link User's Guide (May 2012) p.56. **Decision for us:** leave Force OFF (a transient Vercel cold-start/5xx would otherwise void a good payment) and rely on Inquiry reconciliation instead. Or turn it ON if you prefer "no record means no charge" and accept the voids; your call, but you need to be able to return 200 fast and idempotently.
- Outbound port restriction (legacy guide): Silent/Return posts only support port 80 (HTTP) and 443 (HTTPS); for a secured server add `:443` explicitly to the Silent Post URL (Link guide FAQ p.68). Source IPs of the post: **[UNCONFIRMED], not documented**.
- Fields posted: not fully enumerated in the new docs. The legacy guide lists (ECHODATA=True default) ADDRESS, AMOUNT, AUTHCODE, AVSDATA, CITY, COUNTRY, CSCMATCH, CUSTID, DESCRIPTION, EMAIL, INVOICE, METHOD, NAME, PNREF, PONUM, RESPMSG, RESULT, STATE, TYPE, USER1-USER10, ZIP and shipping equivalents (Link guide pp.56-58, https://www.paypalobjects.com/webstatic/en_US/developer/docs/pdf/pp_payflowlink_guide.pdf). A secondary example of a modern secure-token silent post (from search results citing Magento devdocs, not verified by me) includes BILLTO*, AMT, PNREF, RESULT, RESPMSG, AUTHCODE, AVSDATA, CVV2MATCH, IAVS, PROCCVV2, HOSTCODE, SECURETOKEN, ACCT (masked), POSTFPSMSG. **Build the handler to tolerate unknown/missing fields and log the raw body in a locked-down table (minus anything that looks like a PAN) during pilot testing to learn the real field set for LSBD's account.** `VERBOSITY` controls extra fields in the post (search result paraphrase; **[UNCONFIRMED]**).
- **Gotcha: a "successful" RESULT=0 may be a void.** If Manager AVS/CSC strictness is set and fails, Payflow voids the sale and returns `RESULT=0` with `RESPMSG=AVSDECLINED` or `CSCDECLINED`; you only get the silent post for the sale, not for the void (Link guide pp.57, 69). So treat success as `RESULT=0 AND RESPMSG=Approved` (or exactly the approved strings) and then confirm via Inquiry (section 3).
- Legacy guide says Silent Post fires "whenever a transaction succeeds"; the current developer docs wording is "as soon as the transaction is approved or declined" (search result summary of configure-hosted-checkout). **[UNCONFIRMED]** whether declines are posted for your account type. Design so that absence of a post is handled (token expiry + Inquiry sweep).

### 2.4 Duplicate / replay considerations

- Token is one-time; reuse gives error 160 (already used) per the secure-token page; a concurrent second submit gives 161 (in progress); 162 = expired. (The transaction-responses page summary paraphrased 160-162 slightly differently; PayPal docs are inconsistent on which number is which, so just treat 160/161/162 as "token problem, do not retry blindly, run Inquiry".)
- A fresh `SECURETOKENID` per payment attempt. Persist the `SECURETOKENID` before redirecting. If a customer abandons and returns, create a new token.
- Silent Post and RETURNURL POST can both arrive and can be delivered more than once or out of order: make the handler idempotent on `PNREF` / `CUSTREF` (unique DB constraint), never "mark paid then add credit".
- A customer can hit Back or double-click. Enforce one open payment attempt per renewal on your side.
- There is no signature on silent post/return data (section 3).

### 2.5 RESULT codes you will actually see (transaction-responses page)

0 approved; 1 authentication failed (also what you get from the IP allowlist, per vendor blog); 7 field format error; 12 declined; 19 original transaction ID not found (Inquiry); 23/24 bad account/expiry; 26 invalid vendor; 30 duplicate; 50/51/52 (52 = attempting an API transaction type on a Payflow Link account); 104 processor timeout; 112 AVS fail; 114 CSC mismatch; 125/126/128 fraud filters; 160-162 secure token; negative values = communication errors. VERBOSITY=HIGH adds PROCAVS, PROCCVV2, HOSTCODE, RESPTEXT.

---

## 3. Verifying a result server-side

**There is no signature/HMAC on Silent Post or RETURNURL posts in anything I found.** PayPal's own recommendation, from the legacy Link guide: "PayPal recommends that you use PayPal Manager reports to verify each order and the dollar amount of each transaction when using the Silent Post and Forced Silent Post features" (guide p.54). The modern equivalent is an API **Inquiry**:

- `TRXTYPE=I` returns result and status of a transaction. Look up by `ORIGID` (PNREF), by `CUSTREF` (with optional `STARTTIME`/`ENDTIME`), or by `SECURETOKEN`. PayPal says: "If you do not get a response from the Gateway server, submit an Inquiry transaction, passing in the secure token." Secure-token inquiry is valid for up to **three weeks**; an expired token returns error code 19. Sources: https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/submit-transactions , secure-token page. Example: `TRXTYPE=I&TENDER=C&PARTNER=PayPal&VENDOR=...&USER=...&PWD=...&ORIGID=VPNE12564395&VERBOSITY=HIGH`.
- **Recommended pattern:**
  1. On silent post (and again on browser return), do NOT trust the body. Extract only an identifier (`PNREF`, `CUSTREF`/`SECURETOKENID`/your `USERn`), look up your pending payment row.
  2. Server-to-server Inquiry using `ORIGID=<PNREF>` (or `CUSTREF`, or `SECURETOKEN`) with `VERBOSITY=HIGH`. Compare `RESULT=0`, `RESPMSG`, `AMT` to your DB's expected amount, `CUSTREF`/`INVNUM` to the payment row.
  3. Only then mark the renewal paid. Make that step transactional and idempotent (unique on PNREF).
  4. A scheduled sweep (every few minutes, plus a daily reconcile) Inquires on every payment left in `pending` for > N minutes using `CUSTREF`, catching customers who paid but never returned and silent posts that never arrived. Token inquiry window = 3 weeks.
  5. Also compare daily against the Payflow settlement report (section 5).
- Extra cheap hardening (not from PayPal; our own): put an unguessable per-attempt secret in a `USERn` field or in the RETURNURL query string, and require it to match on callback; rate-limit the callback; IP-log it.
- **Fields to persist:** `PNREF` (PayPal doc: 12 or 17 chars depending on page; store as text, e.g. 20), `RESULT`, `RESPMSG`, `AUTHCODE`, `AVSADDR`/`AVSZIP` (or `AVSDATA` on legacy), `CVV2MATCH` (or `CSCMATCH`), `IAVS`, `CARDTYPE` (0 Visa, 1 MC, 2 Discover, 3 Amex, 4 Diners, 5 JCB, 9 Maestro), `AMT`, `TRANSTIME`, `INVNUM`, `CUSTREF`, `SECURETOKENID`, masked `ACCT` (last 4 only) and expiry month/year if returned, plus the raw verified Inquiry response (with any ACCT masked). Sources: https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/transaction-responses .
- **Do NOT store (PCI):** full PAN (`ACCT` unmasked), CVV2/CSC at all (never allowed to be stored after authorisation), track data, PIN. PayPal's doc lists ACCT, EXPDATE, CVV2/CSC, driver's licence number and SSN as data that PayPal will strip from non-appropriate parameters (https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/security-pci-compliance/). Don't put SSNs or any licensee PII (DOB, SSN) in `COMMENT`/`USER` fields (those are stored/returned in plaintext and visible in Manager). With hosted pages you should never receive a PAN, but defensively log-scrub any 13-19 digit sequences in the raw callback body. Last 4 + brand + expiry are generally treated as non-sensitive by processors (Stripe's guide says the same for its data; PCI's rule is: truncated PAN with at most first 6/last 4 is OK).

---

## 4. Endpoints, TLS, IP allowlisting, Manager settings

| Purpose | Live | Test (pilot) | Source |
|---|---|---|---|
| NVP API (create token, inquiry, void, credit) | `https://payflowpro.paypal.com` | `https://pilot-payflowpro.paypal.com` | payflow-pro-credentials |
| Hosted checkout page | `https://payflowlink.paypal.com` | `https://pilot-payflowlink.paypal.com` | configure-hosted-checkout / test-hosted-pages |
| Reporting API | `https://payments-reports.paypal.com/reportingengine` | `https://payments-reports.paypal.com/test-reportingengine` | https://developer.paypal.com/api/nvp-soap/payflow/reports/ |
| Manager UI | https://manager.paypal.com | (set Transaction Process Mode = Test) | configure-hosted-checkout |

- Use host names, never hard-coded IPs: PayPal says it runs multiple data centres and has maintenance windows (credentials page; revision history Apr 2020).
- **TLS:** PayPal-wide TLS 1.2 and HTTP/1.1 mandatory since April 30 2018, SHA-256 certs (https://github.com/paypal/TLS-update; seen only via a search result, not fetched; **[UNCONFIRMED] for Payflow specifically**). The Payflow credentials page itself states no TLS version. Node 20+/fetch on Vercel negotiates TLS 1.2/1.3 so this is a non-issue; just don't pin certs or old CA bundles.
- **Source-IP allowlisting:**
  - PayPal says IP allowlisting is *optional* for Classic/REST APIs, and for Payflow it offers "optional IP address allowlisting features for Payflow Pro via PayPal Manager" (https://www.paypal.com/bz/cshelp/article/how-do-i-whitelist-my-server%E2%80%99s-ip-address-so-it-can-access-paypal-apis-ts1926).
  - Manager path: Service Settings > Payflow > Allowed IP Addresses; up to 16 addresses; admin only (https://www.paypalobjects.com/en_US/vhelp/paypalmanager_help/pro_ip_address.htm). Once any list is set, everything else is blocked and fails as "User authentication failed" (RESULT=1 per a vendor blog, https://www.quotaguard.com/blog/paypal-payflow-pro-result-1-static-ip, vendor marketing, lower confidence).
  - **Whether it is ON or OFF by default for LSBD's account: [UNCONFIRMED]. Check Manager > Allowed IP Addresses.** If the list is empty, Vercel's dynamic egress works fine. If it is populated (maybe with the old Rackspace/IIS server, 72.32.176.56 or the board's office IP), calls from Vercel will fail with RESULT=1 until you clear it or add Vercel static IPs.
  - If you must allowlist: **Vercel Static IPs** (Pro/Enterprise) give a fixed egress IP pair per region for Vercel Functions, $100/month per project plus Private Data Transfer at regional rates; not applied to Routing Middleware; applies to all environments of the project (https://vercel.com/docs/networking/static-ips). Alternative: a tiny proxy on a fixed-IP host (the board's own server) just for the Payflow calls. Recommendation: leave allowlisting empty, protect by credentials (dedicated API user, strong password), and by Payflow user role; only pay for static IPs if the board's security policy demands it.
  - The hosted page and Silent Post do not need our IP allowlisted; the Silent Post originates from PayPal to us (source IPs undocumented, so do not IP-filter the callback; rely on Inquiry verification).
- **Manager settings needed** (https://www.paypalobjects.com/en_US/vhelp/paypalmanager_help/setup.htm , https://developer.paypal.com/api/nvp-soap/payflow/test-hosted-pages/):
  - Transaction Process Mode: TEST then LIVE (separate switch).
  - **Secure Token: Enable = Yes** (required for hosted pages).
  - Hosted Checkout Pages layout (A/B/C) and look/feel.
  - Payment Confirmation: "On my website" if you want to land back on lsbd pages; supply the Return URL and Return URL Method = POST (to get data on browser return) or LINK.
  - Use Silent Post = Yes + Silent Post URL; Force Silent Post Confirmation = decision above; Failed Silent Post Return URL.
  - Security options: AVS (No/Light/Medium/Full), CSC (No/Light/Full). Per legacy guide AVS does not work in test mode, and AVS Medium/Full can decline everything in test.
  - Create a dedicated API user (Account Administration > Manage Users).
  - **[UNCONFIRMED]** There is no documented "allowed return URL domain" setting in what I fetched.
- Test card: 4111 1111 1111 1111 (any future expiry, CVV 123) in pilot; match card to processor type (test-hosted-pages tip). Note pilot only works if the pilot account is provisioned: PayPal Payments Advanced uses sandbox business accounts; classic Payflow Pro/Link needs the merchant to be in Test mode.

---

## 5. Refunds, voids, settlement, reporting

- **Void (`TRXTYPE=V`)**: only on a transaction that has not yet settled; voided transaction does not appear on the customer's statement. **Credit/refund (`TRXTYPE=C`)**: referenced by `ORIGID=<PNREF>`; non-referenced credits are possible only if enabled on the account (not recommended). `D` = delayed capture for prior `A`. Source: https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/submit-transactions . Credits and voids by API need a role with credit permission (not `LIMITED_TRANSACTIONS`) (credentials page). On Limited Access (new Link) accounts, **[UNCONFIRMED]** whether API `C`/`V` are allowed; the Limited Access description says "most API functions" but only S/A are blocked.
- **Settlement timing:** "At least once a day, PayPal gathers all transactions flagged for settlement and sends them in a batch file to the processor"; funds typically take several days to appear (submit-transactions). Void is therefore generally possible until the daily batch cut-off **[exact cut-off time UNCONFIRMED]**; afterwards use Credit.
- **Reporting:**
  - Manager reports (web UI): transaction detail / settlement reports; PayPal says to use these to verify orders (legacy guide).
  - **Reporting API** (XML over HTTPS POST, `Content-Type: text/plain`, no SDK) at `https://payments-reports.paypal.com/reportingengine`: manage report templates, run reports by name/template, fetch status/results, schedule, search transactions by ID/batch/account number. Sources: https://developer.paypal.com/api/nvp-soap/payflow/reports/ , https://developer.paypal.com/api/nvp-soap/payflow/reports/use-the-api/ , https://developer.paypal.com/api/nvp-soap/payflow/reports/report-parameters/ . Needs a Manager user with reporting rights; the specific report names (e.g. "Settlement Report", "Transaction Detail") should be taken from the report-parameters page. Which role/user types may call it **[UNCONFIRMED]**.
  - Reconciliation plan: nightly job pulls the prior day's settlement/transaction report via Reporting API, matches by PNREF and AMT to `payments` table, flags (a) paid in PayPal but not in DB, (b) paid in DB but missing/voided in PayPal, (c) amount mismatches. This is also how the board's bookkeeping ties out to the bank deposit batch.

---

## 6. PCI scope

- Pattern: customer's browser enters card data on PayPal's hosted page; merchant gets only token results. PayPal: "the customer submits their credit card number, expiration date, and other sensitive data directly to the host pages rather than to your website, easing your PCI compliance requirements" (https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/security-pci-compliance/). PayPal still states "It is your responsibility to adhere to PCI compliance standards".
- Expected SAQ: **SAQ A** (card-not-present, fully outsourced). That is my inference; PayPal's page does not name the SAQ. Confirm with whoever acts as the board's acquirer/PCI contact; the acquirer or the board's merchant bank may dictate the SAQ/validation. **[UNCONFIRMED, inference]**
- **PCI DSS v4.0.1 SAQ A (Jan 2025 revision, effective 2025-03-31):** requirements 6.4.3, 11.6.1 and 12.3.1 were *removed from SAQ A* and replaced by an eligibility criterion that the merchant "has confirmed that their site is not susceptible to attacks from scripts that could affect the merchant's e-commerce system(s)". Per secondary sources (HALock, Jscrambler, TrustedSec, not the official PCI SSC FAQ page itself), this script criterion applies to merchants who **embed** a third-party payment form (iframe) on their own page, and does not apply to merchants who **redirect** to the processor's page. Sources: https://www.halock.com/pci-ssc-updates-saq-a-removal-of-key-e-commerce-security-requirements-new-eligibility-criteria/ , https://jscrambler.com/blog/saq-a-new-eligibility-criteria/ . I could not retrieve PCI SSC's own FAQ 1588 text, so **verify at pcisecuritystandards.org**.
- **Consequence:** use the **full redirect (Layout A/B)**, not the Layout C iframe. Then the script-integrity requirement (6.4.3/11.6.1 or the "not susceptible to scripts" attestation) is effectively moot for the payment page, because the card form is on PayPal's domain. If the board later insists on the embedded look, you will need to manage script inventory/CSP/SRI on the page that hosts the iframe and re-attest.
- What remains for us regardless: TLS on all pages; MFA/strong auth on admin accounts that can see payments; keep Payflow credentials in Vercel encrypted env vars (never client side, rotate); log scrubbing; no PAN/CVV in logs/DB; restrict who can issue credits (and use a separate Manager user for staff); annual SAQ A attestation and quarterly ASV scans only if the acquirer requires (ASV scans for SAQ A are often still required by banks; **[UNCONFIRMED] for LSBD's acquirer**); incident-response contact. Also CSP `form-action https://payflowlink.paypal.com` and `frame-src` as needed.

---

## 7. Stripe Checkout fallback (only because #1 shows a soft risk, not a hard sunset)

The Payflow risk is real but undated: the vendor labels the hosted product "legacy", the doc set shows little new development, and a likely preconditions snag (account type, IP allowlist). It is not a forced migration today. A Stripe fallback is therefore a contingency, and worth designing the payment layer behind a small interface (`createPayment`, `verifyPayment`, `refund`, `reconcile`) so you can swap providers.

| | Payflow (Secure Token + hosted page) | Stripe Checkout (hosted redirect) |
|---|---|---|
| Effort | Medium-high: NVP string APIs (no official modern Node SDK), token creation, silent post + Inquiry verification we must build, Manager config, pilot account quirks, IP allowlist question, odd docs inconsistencies | Low-medium: official `stripe` Node SDK, Checkout Session API, signed webhooks (`checkout.session.completed`) with signature verification, idempotency keys, built-in receipts, Dashboard refunds, test mode |
| Authenticity of callback | None (must Inquiry) | Signed webhooks; Stripe's guide says verify signatures and allowlist Stripe IPs (https://docs.stripe.com/security/guide) |
| Fees (general terms) | PayPal's fees for Payflow: reported as about $0.10/txn plus PayPal/processor rate; Payflow Pro about $25/month, Payflow Link no monthly fee; **plus your merchant-account/processor fees** (from third-party aggregators, **[UNCONFIRMED]**; confirm with PayPal and the bank) | Public standard rate for US cards: 2.9% + 30 cents per successful domestic card transaction, no setup/monthly fee; volume/IC+ pricing available (https://stripe.com/pricing). On a ~$590 renewal that is about $17.4 per payment |
| PCI | SAQ A likely (redirect) | SAQ A with Stripe-hosted Checkout (redirect) per Stripe low-risk integrations (https://docs.stripe.com/security/guide); Stripe Elements/embedded needs the same script-hygiene consideration |
| Refund/void | API C/V with ORIGID | Dashboard/API refunds |
| Risk | Legacy-labelled product, no stated sunset | Mature, but changes merchant account/bank relationship, funds flow and bookkeeping |

Government-board specifics to check before committing to either: whether the board wants to absorb or pass on card fees (Louisiana state agencies often have rules/contracts about card acceptance and convenience fees, **[UNCONFIRMED]**, ask the board / state treasury), and existing merchant-bank contract.

---

## 8. Open items to resolve with PayPal / board (priority order)

1. Manager Service Summary label (legacy Link / new Link Limited / legacy Pro / new Pro Full) and merchant-account type (PayPal-processed vs bank/IMA).
2. Written answer from PayPal MTS on product lifecycle and whether secure token + hosted pages are available on the account.
3. Manager > Allowed IP Addresses current contents; decide on empty list vs Vercel Static IPs ($100/mo + data).
4. Credentials: are PARTNER/VENDOR/USER/PWD known and working in pilot; create dedicated API user.
5. Silent Post exact field set and decline-posting behaviour on this account (test in pilot, log raw body).
6. Force Silent Post on/off decision; fraud/AVS/CSC strictness settings.
7. SAQ type and any acquirer-mandated requirements (ASV scans, attestation owner).
8. Fee schedule and any government convenience-fee rules.

## Key source URLs

- https://developer.paypal.com/api/nvp-soap/payflow/payflow-gateway/
- https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/
- https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/secure-token/
- https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/configure-hosted-checkout
- https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/gateway-checkout-solutions
- https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/payflow-link-migration/
- https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/submit-transactions
- https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/transaction-responses
- https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/security-pci-compliance/
- https://developer.paypal.com/api/nvp-soap/payflow/integration-guide/reference/revision-history/
- https://developer.paypal.com/api/nvp-soap/payflow/payflow-pro/payflow-pro-credentials
- https://developer.paypal.com/api/nvp-soap/payflow/test-hosted-pages/
- https://developer.paypal.com/api/nvp-soap/payflow/gs-ppa-hosted-pages/
- https://developer.paypal.com/api/nvp-soap/payflow/reports/
- https://www.paypalobjects.com/en_US/vhelp/paypalmanager_help/setup.htm
- https://www.paypalobjects.com/en_US/vhelp/paypalmanager_help/pro_ip_address.htm
- https://www.paypalobjects.com/webstatic/en_US/developer/docs/pdf/pp_payflowlink_guide.pdf (2012)
- https://vercel.com/docs/networking/static-ips
- https://docs.stripe.com/security/guide , https://stripe.com/pricing
