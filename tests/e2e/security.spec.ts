import { test, expect, pathOf } from "./helpers/fixtures";

// Response headers (src/lib/security-headers.ts, next.config.ts) and the admin gate.
// Nothing here signs in: failed sign-ins are rate-limited and could lock the real admin out.

test.describe("security headers on /", () => {
  test("CSP, Permissions-Policy and HSTS are set; X-Powered-By is not", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const h = res.headers();

    const csp = h["content-security-policy"];
    expect(csp, "Content-Security-Policy header").toBeTruthy();
    expect(csp).not.toContain("unsafe-eval");
    for (const directive of [
      "default-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp).toMatch(/img-src [^;]*https:\/\/[a-z0-9*]+\.public\.blob\.vercel-storage\.com/);

    expect(h["permissions-policy"], "Permissions-Policy header").toBeTruthy();
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["x-powered-by"], "X-Powered-By header").toBeUndefined();
    expect(h["strict-transport-security"], "Strict-Transport-Security header").toMatch(/max-age=\d{7,}/);
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

test.describe("admin gate, signed out", () => {
  for (const path of ["/admin", "/admin/publications", "/admin/publications/new", "/admin/users"]) {
    test(`${path} answers with a redirect to the sign-in page`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([302, 303, 307, 308]).toContain(res.status());
      expect(pathOf(new URL(res.headers()["location"], "https://placeholder.invalid"))).toBe("/admin/login");
    });
  }

  test("/admin lands on the sign-in page, which renders cleanly", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL((u) => pathOf(u) === "/admin/login");
    await expect(page.getByText("Admin Sign In")).toBeVisible();
    await expect(page.getByLabel("Email Address")).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "Sign In" })).toBeEnabled();
    // No admin chrome before sign-in.
    await expect(page.getByRole("navigation", { name: "Admin navigation" })).toHaveCount(0);
    await page.waitForLoadState("networkidle").catch(() => {});
    // The `monitor` fixture fails this test if the page logged an error or a CSP violation.
  });
});
