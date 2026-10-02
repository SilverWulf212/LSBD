import { test, expect, pathOf, isSameOrigin } from "./helpers/fixtures";

// Opt-in, read-only tour of the admin. Runs only when both E2E_ADMIN_EMAIL and
// E2E_ADMIN_PASSWORD are set. It signs in ONCE, then opens each sidebar page.
// It creates, edits and deletes nothing and submits no form: after sign-in every
// request that is not GET/HEAD is blocked in the browser and fails the test.
//
// Sign-in is limited to 5 failures per email per 15 minutes. If this test reports a
// failed sign-in, fix the credentials before rerunning; do not rerun it in a loop.

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe("admin (opt-in)", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "admin tour skipped: set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run it (one sign-in, read-only)"
  );
  test.use({ viewport: { width: 1440, height: 900 } });

  test("sign in once and open every sidebar page", async ({ page, monitor }) => {
    test.setTimeout(5 * 60_000);

    await page.goto("/admin/login");
    await page.getByLabel("Email Address").fill(EMAIL!);
    await page.getByLabel("Password").fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign In" }).click();

    const sidebar = page.getByRole("navigation", { name: "Admin navigation" });
    const signInError = page.getByText(/Invalid email or password|unexpected error/i);
    await expect(sidebar.or(signInError).first()).toBeVisible({ timeout: 30_000 });
    if (await signInError.isVisible()) {
      throw new Error(
        "Admin sign-in was rejected. Check E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD before rerunning: " +
          "failed sign-ins are limited to 5 per email per 15 minutes."
      );
    }
    expect(pathOf(page.url())).toBe("/admin");
    monitor.reset(); // judge the admin pages, not the sign-in round trip

    // From here on the test is read-only by construction.
    const blockedWrites: string[] = [];
    await page.route("**/*", (route) => {
      const req = route.request();
      if (isSameOrigin(req.url()) && !["GET", "HEAD", "OPTIONS"].includes(req.method())) {
        blockedWrites.push(`${req.method()} ${req.url()}`);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });

    const links = await sidebar.locator("ul a").evaluateAll((as) =>
      as.map((a) => ({ href: a.getAttribute("href") || "", label: (a.textContent || "").trim() }))
    );
    expect(links.length, "sidebar links").toBeGreaterThan(0);

    const problems: string[] = [];
    for (const link of links) {
      await test.step(`${link.label} (${link.href})`, async () => {
        monitor.reset();
        await sidebar.locator(`ul a[href="${link.href}"]`).click();
        await page.waitForURL((u) => pathOf(u) === link.href || pathOf(u) === "/admin/403" || pathOf(u) === "/admin/login");
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const landed = pathOf(page.url());
        if (landed !== link.href) problems.push(`${link.href}: redirected to ${landed}`);
        const h1 = page.locator("main h1");
        if ((await h1.count()) !== 1 || !(await h1.first().isVisible())) {
          problems.push(`${link.href}: expected one visible <h1> in the page body, found ${await h1.count()}`);
        }
        if (await page.getByText(/something went wrong|application error/i).count()) {
          problems.push(`${link.href}: the page shows an error screen`);
        }
        for (const line of monitor.all()) problems.push(`${link.href}: ${line}`);
        await page.waitForTimeout(300);
      });
    }
    monitor.reset();

    expect(blockedWrites, "admin pages must not send write requests just by being opened").toEqual([]);
    expect(problems, "admin pages with problems").toEqual([]);
  });
});
