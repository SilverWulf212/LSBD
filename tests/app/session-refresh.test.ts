import { describe, expect, it, vi } from "vitest";
import { refreshSessionToken, SESSION_MAX_AGE_SECONDS, SESSION_RECHECK_MS } from "../../src/lib/session-refresh";

const NOW = Date.parse("2026-10-02T12:00:00Z");
const min = (n: number) => n * 60_000;
const iat = Math.floor((NOW - min(60)) / 1000);
const before = new Date(NOW - min(120));

const token = (over: Record<string, unknown> = {}) => ({ id: "7", role: "staff", iat, checkedAt: NOW - min(6), ...over });

describe("session constants", () => {
  it("uses 8-hour sessions and a 5-minute re-check", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
    expect(SESSION_RECHECK_MS).toBe(5 * 60_000);
  });
});

describe("refreshSessionToken", () => {
  it("returns the same token without a lookup when checked 4 minutes ago", async () => {
    const lookup = vi.fn();
    const t = token({ checkedAt: NOW - min(4) });
    expect(await refreshSessionToken(t, lookup, NOW)).toBe(t);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("picks up a changed role and stamps checkedAt when due", async () => {
    const lookup = vi.fn().mockResolvedValue({ role: "admin", updatedAt: before });
    const out = await refreshSessionToken(token(), lookup, NOW);
    expect(lookup).toHaveBeenCalledWith(7);
    expect(out).toMatchObject({ id: "7", role: "admin", checkedAt: NOW });
  });

  it("treats a token with no checkedAt as due", async () => {
    const lookup = vi.fn().mockResolvedValue({ role: "staff", updatedAt: before });
    const out = await refreshSessionToken(token({ checkedAt: undefined }), lookup, NOW);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(out?.checkedAt).toBe(NOW);
  });

  it("returns null when the user no longer exists", async () => {
    expect(await refreshSessionToken(token(), async () => undefined, NOW)).toBeNull();
  });

  it("returns null when the user changed after the token was issued", async () => {
    const lookup = async () => ({ role: "staff", updatedAt: new Date(iat * 1000 + 1) });
    expect(await refreshSessionToken(token(), lookup, NOW)).toBeNull();
  });

  it("keeps the original token when the lookup fails", async () => {
    const t = token();
    const out = await refreshSessionToken(t, () => Promise.reject(new Error("db down")), NOW);
    expect(out).toMatchObject({ role: "staff", checkedAt: t.checkedAt });
  });

  it.each([undefined, "", "abc", "0", "-3", "1.5", "7x"])("returns null without a lookup for id %j", async (id) => {
    const lookup = vi.fn();
    expect(await refreshSessionToken(token({ id }), lookup, NOW)).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});
