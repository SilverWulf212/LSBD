import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // tests/e2e holds Playwright specs (npm run test:e2e), not vitest tests.
    exclude: ["node_modules/**", ".next/**", "src/**", "tests/e2e/**"],
  },
});
