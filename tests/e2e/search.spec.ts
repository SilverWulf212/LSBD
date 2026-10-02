import { test, expect, expectPageLoaded, pathOf } from "./helpers/fixtures";

// The header search is a page finder over the menu (src/components/layout/search-dialog.tsx);
// it does not call the server. /api/search is a separate endpoint, limited to 30 requests
// per minute per IP in production: two requests here.

test.describe("header search dialog", () => {
  test("a query lists matching pages and a result navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search pages" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("Search pages...").fill("renewal");
    const options = dialog.getByRole("option");
    await expect(options).toHaveCount(2);
    await expect(options).toHaveText([/Dentists - Renewal/, /Hygienists - Renewal/]);

    await options.filter({ hasText: "Hygienists - Renewal" }).click();
    await page.waitForURL((u) => pathOf(u) === "/hygienists/renewal");
    await expect(dialog).toBeHidden();
    await expectPageLoaded(page);
  });

  test("Ctrl+K opens it, Enter follows the first result, nonsense finds nothing", async ({ page }) => {
    await page.goto("/");
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const input = dialog.getByPlaceholder("Search pages...");

    await input.fill("zzqxjvkw");
    await expect(dialog.getByText("No pages found.")).toBeVisible();
    await expect(dialog.getByRole("option")).toHaveCount(0);

    await input.fill("fee schedule");
    await expect(dialog.getByRole("option").first()).toHaveText(/Fee Schedule/);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => pathOf(u) === "/resources/fees");
    await expectPageLoaded(page);
  });
});

test.describe("/api/search", () => {
  test("answers a query with a results array and ignores a one-letter query", async ({ request }) => {
    const hit = await request.get("/api/search?q=meeting");
    expect(hit.status()).toBe(200);
    const body = (await hit.json()) as { results: { type: string; title: string; url: string }[] };
    expect(Array.isArray(body.results)).toBe(true);
    for (const r of body.results) {
      expect(["post", "page", "meeting"]).toContain(r.type);
      expect(r.url.startsWith("/")).toBe(true);
    }

    const short = await request.get("/api/search?q=a");
    expect(short.status()).toBe(200);
    expect(await short.json()).toEqual({ results: [] });
  });
});
