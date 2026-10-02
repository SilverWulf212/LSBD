import type { BrowserContext, Page } from "@playwright/test";
import { NAV_ITEMS, EXTERNAL_LINKS } from "../../src/lib/constants";
import { navLinks, type NavItem } from "../../src/lib/nav";
import { test, expect, expectPageLoaded, pathOf } from "./helpers/fixtures";

const ITEMS = NAV_ITEMS as readonly NavItem[];
const LOGIN_URL = EXTERNAL_LINKS.dentistLogin;

/** Answer the third-party login site locally so the test never loads it. */
async function stubLicenseeLogin(context: BrowserContext): Promise<void> {
  await context.route(`${new URL(LOGIN_URL).origin}/**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title><h1>stub</h1>" })
  );
}

async function expectAt(page: Page, href: string): Promise<void> {
  await page.waitForURL((u) => pathOf(u) === href);
  await expectPageLoaded(page);
}

test.describe("desktop menu (1280 wide)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("each top-level item opens its panel and every link loads a page", async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("button")).toHaveText(ITEMS.map((i) => i.label));

    for (const item of ITEMS) {
      const links = navLinks(item);
      const trigger = nav.getByRole("button", { name: item.label, exact: true });
      const panel = trigger.locator("xpath=following-sibling::div");

      for (const [index, link] of links.entries()) {
        await test.step(`${item.label} > ${link.label} (${link.href})`, async () => {
          await page.mouse.move(5, 600); // leave the header so the hover is a fresh one
          await trigger.hover();
          await expect(trigger).toHaveAttribute("aria-expanded", "true");
          await expect(panel).toBeVisible();
          if (index === 0) {
            await expect(panel.getByRole("link")).toHaveText(links.map((l) => l.label));
          }
          await panel.locator(`a[href="${link.href}"]`).click();
          await expectAt(page, link.href);
          await page.waitForTimeout(250);
        });
      }
    }
  });

  test("header button Verify a License goes to the search page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Verify a License" }).click();
    await expectAt(page, "/public/verify");
    await expect(page.locator("h1")).toHaveText(/verify a license/i);
  });

  test("header button Licensee Login opens the licensee portal in a new tab", async ({ page, context }) => {
    await stubLicenseeLogin(context);
    await page.goto("/");
    const login = page.getByRole("banner").getByRole("link", { name: /Licensee Login/ });
    await expect(login).toHaveAttribute("href", LOGIN_URL);
    await expect(login).toHaveAttribute("target", "_blank");
    await expect(login).toHaveAttribute("rel", /noopener/);

    const [popup] = await Promise.all([context.waitForEvent("page"), login.click()]);
    await popup.waitForURL(LOGIN_URL);
    expect(pathOf(page.url())).toBe("/"); // the site itself stays put
    await popup.close();
  });
});

test.describe("mobile menu (390 wide)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const openDrawer = async (page: Page) => {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    return drawer;
  };

  test("the drawer opens and every link loads a page", async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();

    for (const item of ITEMS) {
      const links = navLinks(item);
      for (const [index, link] of links.entries()) {
        await test.step(`${item.label} > ${link.label} (${link.href})`, async () => {
          const drawer = await openDrawer(page);
          const mobileNav = drawer.getByRole("navigation", { name: "Mobile navigation" });
          const trigger = mobileNav.getByRole("button", { name: item.label, exact: true });
          if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
          await expect(trigger).toHaveAttribute("aria-expanded", "true");
          if (index === 0) {
            for (const l of links) await expect(mobileNav.locator(`a[href="${l.href}"]`)).toHaveText(l.label);
          }
          const before = pathOf(page.url());
          await mobileNav.locator(`a[href="${link.href}"]`).click();
          await expectAt(page, link.href);
          if (before !== link.href) await expect(drawer).toBeHidden(); // closes once the page changes
          else await page.keyboard.press("Escape");
          await page.waitForTimeout(250);
        });
      }
    }
  });

  test("drawer buttons: Verify a License and Licensee Login", async ({ page, context }) => {
    await stubLicenseeLogin(context);
    await page.goto("/");
    let drawer = await openDrawer(page);

    const login = drawer.getByRole("link", { name: /Licensee Login/ });
    await expect(login).toHaveAttribute("href", LOGIN_URL);
    await expect(login).toHaveAttribute("target", "_blank");
    await expect(login).toHaveAttribute("rel", /noopener/);
    const [popup] = await Promise.all([context.waitForEvent("page"), login.click()]);
    await popup.waitForURL(LOGIN_URL);
    await popup.close();

    if (!(await drawer.isVisible())) drawer = await openDrawer(page);
    await drawer.getByRole("link", { name: "Verify a License", exact: true }).click();
    await expectAt(page, "/public/verify");
    await expect(drawer).toBeHidden();
  });
});
