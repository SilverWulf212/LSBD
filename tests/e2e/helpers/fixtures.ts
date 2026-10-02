import { test as base, expect, type Page } from "@playwright/test";
import { E2E_BASE_URL } from "./env";

export const ORIGIN = new URL(E2E_BASE_URL).origin;

/** What a real browser complained about while a page was open. */
export interface PageIssues {
  pageErrors: string[];
  consoleErrors: string[];
  cspViolations: string[];
  failedRequests: string[];
  badResponses: string[];
}

export interface Monitor {
  issues: PageIssues;
  /** Requests the browser cancelled itself (navigation away, prefetch dropped). Not failures. */
  aborted: string[];
  /** Fail the test at teardown if anything was recorded. The crawl turns this off and reports per page. */
  autoAssert: boolean;
  /** Start a fresh record (the crawl calls this before each page). */
  reset(): void;
  /** Every issue as one "kind: message" line. */
  all(): string[];
}

function emptyIssues(): PageIssues {
  return { pageErrors: [], consoleErrors: [], cspViolations: [], failedRequests: [], badResponses: [] };
}

const CSP_TEXT = /content security policy|content-security-policy/i;

export async function attachMonitor(page: Page): Promise<Monitor> {
  const mon: Monitor = {
    issues: emptyIssues(),
    aborted: [],
    autoAssert: true,
    reset() {
      mon.issues = emptyIssues();
      mon.aborted = [];
    },
    all() {
      const i = mon.issues;
      return [
        ...i.pageErrors.map((m) => `page error: ${m}`),
        ...i.consoleErrors.map((m) => `console error: ${m}`),
        ...i.cspViolations.map((m) => `CSP violation: ${m}`),
        ...i.failedRequests.map((m) => `failed request: ${m}`),
        ...i.badResponses.map((m) => `bad response: ${m}`),
      ];
    },
  };

  // The browser's own CSP report, sent to the test as it happens so it survives navigations.
  await page.exposeFunction("__e2eReportCsp", (text: string) => {
    mon.issues.cspViolations.push(text);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      const where = e.sourceFile ? ` at ${e.sourceFile}:${e.lineNumber}` : "";
      const report = (window as unknown as { __e2eReportCsp?: (t: string) => void }).__e2eReportCsp;
      report?.(`[${e.disposition}] ${e.effectiveDirective} blocked ${e.blockedURI || "(inline)"} on ${e.documentURI}${where}`);
    });
  });

  page.on("pageerror", (err) => {
    mon.issues.pageErrors.push(`${err.name}: ${err.message}`);
  });
  page.on("console", (msg) => {
    const text = msg.text();
    if (CSP_TEXT.test(text)) {
      mon.issues.cspViolations.push(`[console ${msg.type()}] ${text}`);
      return;
    }
    if (msg.type() !== "error") return;
    const url = msg.location().url;
    mon.issues.consoleErrors.push(url && !text.includes(url) ? `${text} (${url})` : text);
  });
  page.on("requestfailed", (req) => {
    const reason = req.failure()?.errorText ?? "unknown";
    const line = `${req.method()} ${req.url()} - ${reason}`;
    if (reason.includes("ERR_ABORTED")) {
      mon.aborted.push(line);
      return;
    }
    if (isSameOrigin(req.url())) mon.issues.failedRequests.push(line);
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && isSameOrigin(res.url())) {
      mon.issues.badResponses.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });
  return mon;
}

export function isSameOrigin(url: string): boolean {
  try {
    return new URL(url).origin === ORIGIN;
  } catch {
    return false;
  }
}

/**
 * `monitor` is attached to every test's page. Unless a test turns `autoAssert` off, the
 * test fails at teardown if the browser logged an error, a CSP violation, an uncaught
 * exception or a failed same-origin request.
 */
export const test = base.extend<{ monitor: Monitor }>({
  monitor: [
    async ({ page }, use) => {
      const mon = await attachMonitor(page);
      await use(mon);
      if (mon.autoAssert) {
        expect(mon.all(), "the browser reported problems during this test").toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };

/** The page shows real content: one visible <h1> that is not the 404 page. */
export async function expectPageLoaded(page: Page): Promise<void> {
  const h1 = page.locator("h1");
  await expect(h1).toHaveCount(1);
  await expect(h1).toBeVisible();
  await expect(h1).not.toHaveText(/page not found/i);
}

export function pathOf(url: string | URL): string {
  return new URL(url.toString()).pathname;
}
