import { describe, expect, it } from "vitest";
import { clientIp } from "../../src/lib/client-ip";

const h = (m: Record<string, string>) => ({ get: (name: string) => m[name] ?? null });

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry, trimmed", () => {
    expect(clientIp(h({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1", "x-real-ip": "198.51.100.2" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip", () => {
    expect(clientIp(h({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(h({ "x-forwarded-for": "", "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });
  it("falls back to unknown", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });
});
