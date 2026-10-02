import type { Page } from "@playwright/test";
import { test, expect, expectPageLoaded, pathOf } from "./helpers/fixtures";

// Licence verification. Production limits searches to 30 per minute per IP, so this
// file makes four page loads in total and drops the browser's link prefetches for
// result rows (a results page would otherwise prefetch every row's detail page).

const RATE_LIMITED = /too many searches/i;

async function dropDetailPrefetches(page: Page): Promise<void> {
  await page.route(/\/public\/verify\/[^/?]+/, (route) => {
    const h = route.request().headers();
    const isPrefetch =
      "next-router-prefetch" in h || "next-router-segment-prefetch" in h || h["purpose"] === "prefetch";
    return isPrefetch ? route.abort("aborted") : route.continue();
  });
}

async function expectNotRateLimited(page: Page): Promise<void> {
  await expect(page.getByText(RATE_LIMITED), "the production rate limit was hit; wait a minute and rerun").toHaveCount(0);
}

test.describe("licence verify", () => {
  test.beforeEach(async ({ page }) => {
    await dropDetailPrefetches(page);
  });

  test("a last-name search lists matches and the first result opens a detail page", async ({ page }) => {
    const response = await page.goto("/public/verify?last_name=smith");
    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expectNotRateLimited(page);

    const summary = page.getByText(/^\d+ of \d+ match(es)?\b/);
    await expect(summary).toBeVisible();
    const [, shown, total] = /^(\d+) of (\d+)/.exec((await summary.textContent()) ?? "") ?? [];
    expect(Number(total)).toBeGreaterThan(0);
    expect(Number(shown)).toBeLessThanOrEqual(Number(total));

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveText(["License", "Name", "Type", "Status", "Issued", "Expires"]);
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(Number(shown));
    await expect(rows.first().locator("td").nth(1)).toHaveText(/^SMITH/);
    await expect(page.locator("#last_name")).toHaveValue("smith");

    const first = rows.first().getByRole("link");
    const licenseId = ((await first.textContent()) ?? "").trim();
    expect(licenseId).not.toBe("");
    await first.click();

    await page.waitForURL((u) => /^\/public\/verify\/[^/]+$/.test(pathOf(u)));
    expect(decodeURIComponent(pathOf(page.url()))).toBe(`/public/verify/${licenseId}`);
    await expectNotRateLimited(page);
    await expectPageLoaded(page);
    await expect(page.locator("h1")).toContainText(licenseId);
    await expect(page.getByRole("link", { name: "Back to search" })).toBeVisible();
    await expect(page.getByText("License number", { exact: true }).first()).toBeVisible();
    await expect(page.locator("dd").first()).toHaveText(licenseId);
  });

  test("an empty search shows no results section", async ({ page }) => {
    await page.goto("/public/verify");
    await expectPageLoaded(page);
    await page.getByRole("button", { name: "Search", exact: true }).click(); // plain GET form, all fields blank
    await page.waitForURL((u) => u.search.includes("last_name="));
    await expectPageLoaded(page);

    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText(/\d+ of \d+ match/)).toHaveCount(0);
    await expect(page.getByText("No matches found")).toHaveCount(0);
    await expect(page.getByText(/Enter a license number, or|Enter a valid name/)).toHaveCount(0);
    await expectNotRateLimited(page);
    await expect(page.getByRole("heading", { name: "What you can look up" })).toBeVisible();
  });

  test("a nonsense name shows the no-results text", async ({ page }) => {
    await page.goto("/public/verify?last_name=zzqxjvkw");
    await expectNotRateLimited(page);
    await expect(page.getByText("No matches found")).toBeVisible();
    await expect(page.getByText(/Try adjusting your search/)).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Clear" })).toBeVisible();
  });
});
