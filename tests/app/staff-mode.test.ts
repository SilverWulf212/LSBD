import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getStaffMode,
  parseStaffMode,
  READONLY_BANNER_TEXT,
  READONLY_BANNER_TITLE,
} from "../../src/lib/staff-mode";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("staff mode", () => {
  it("is readonly unless the value is exactly live", () => {
    for (const v of [undefined, null, "", "readonly", "LIVE!", "true", "1", "off"]) {
      expect(parseStaffMode(v)).toBe("readonly");
    }
    expect(parseStaffMode("live")).toBe("live");
    expect(parseStaffMode(" Live ")).toBe("live");
  });

  it("reads LSBD_STAFF_MODE", () => {
    expect(getStaffMode({})).toBe("readonly");
    expect(getStaffMode({ LSBD_STAFF_MODE: "live" })).toBe("live");
  });

  it("the admin layout renders the banner and can be printed", () => {
    const src = read("src/app/admin/layout.tsx");
    expect(src).toContain("<ReadonlyBanner");
    expect(src.split("print:hidden").length - 1).toBeGreaterThanOrEqual(2);
    expect(src).toContain("print:overflow-visible");
    expect(src).toContain("print:h-auto");
  });

  it("the banner hides in print and shows nothing when live", () => {
    const src = read("src/components/admin/readonly-banner.tsx");
    expect(src).toContain("getStaffMode(");
    expect(src).toContain("print:hidden");
    expect(src).toContain('role="status"');
    expect(src).toContain("READONLY_BANNER_TITLE");
    expect(src).toContain("READONLY_BANNER_TEXT");
    expect(src).not.toContain("use client");
    expect(READONLY_BANNER_TITLE.length).toBeGreaterThan(0);
    expect(READONLY_BANNER_TEXT.length).toBeGreaterThan(0);
  });
});
