import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke suite. It runs against a deployed site (production by default),
// so it is deliberately slow and gentle: one worker, no retries, GET/HEAD only.
//
//   npm run test:e2e
//   E2E_BASE_URL=https://some-preview.vercel.app npm run test:e2e
//
// The admin spec only runs when E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are set.
import { E2E_BASE_URL } from "./tests/e2e/helpers/env";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e-results/results.json" }],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: E2E_BASE_URL,
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
