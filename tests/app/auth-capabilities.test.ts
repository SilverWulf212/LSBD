import { describe, expect, it } from "vitest";
import { CAPABILITIES, ROLE_CAPABILITIES, can } from "../../src/lib/auth-capabilities";
import { LSBD_ROLES } from "../../src/lib/auth-roles";

describe("capabilities", () => {
  it("covers every role", () => {
    expect(Object.keys(ROLE_CAPABILITIES).sort()).toEqual([...LSBD_ROLES].sort());
  });
  it("admin has every capability", () => {
    for (const c of CAPABILITIES) expect(can("admin", c)).toBe(true);
  });
  it("only admin and staff may write CMS content", () => {
    expect(LSBD_ROLES.filter((r) => can(r, "cms.write"))).toEqual(["admin", "staff"]);
  });
  it("only admin manages users, sync and settings", () => {
    for (const c of ["users.manage", "sync.view", "settings.manage"] as const)
      expect(LSBD_ROLES.filter((r) => can(r, c))).toEqual(["admin"]);
  });
  it("pii.read is admin and staff; discipline.read is admin and discipline", () => {
    expect(LSBD_ROLES.filter((r) => can(r, "pii.read"))).toEqual(["admin", "staff"]);
    expect(LSBD_ROLES.filter((r) => can(r, "discipline.read"))).toEqual(["admin", "discipline"]);
  });
  it("denies a missing or unknown role", () => {
    expect(can(null, "cms.read")).toBe(false);
    expect(can(undefined, "cms.read")).toBe(false);
    expect(can("nope" as never, "cms.read")).toBe(false);
    expect(can("constructor" as never, "cms.read")).toBe(false);
  });
});
