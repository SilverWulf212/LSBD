import { describe, expect, it } from "vitest";
import { rateLimit, rateLimitKeyCount } from "../../src/lib/rate-limit";

describe("rateLimit", () => {
  it("blocks the 31st call in a minute and allows again after the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 30; i++) {
      expect(rateLimit("rl-test:a", 30, 60_000, t0 + i).ok).toBe(true);
    }
    expect(rateLimit("rl-test:a", 30, 60_000, t0 + 30).ok).toBe(false);
    expect(rateLimit("rl-test:a", 30, 60_000, t0 + 120_000).ok).toBe(true);
  });

  it("stops counting a key once its window has expired and another key is used", () => {
    const t0 = 5_000_000;
    rateLimit("rl-test:expiring", 30, 60_000, t0);
    const before = rateLimitKeyCount();
    rateLimit("rl-test:other", 30, 60_000, t0 + 120_000);
    // the expired key is swept as the new key is added, so the count cannot grow
    expect(rateLimitKeyCount()).toBeLessThanOrEqual(before);
  });
});
