import { describe, it, expect } from "vitest";
import { keyOf, diffKeys, massDeleteGuard } from "../../scripts/sync/diff";

describe("keyOf", () => {
  it("lowercases uniqueidentifier", () => {
    expect(keyOf("ABCDEF00-0000-0000-0000-000000000001", "uniqueidentifier")).toBe(
      "abcdef00-0000-0000-0000-000000000001",
    );
  });
  it("preserves nvarchar exactly (no trim, no case change)", () => {
    expect(keyOf("A1 ", "nvarchar")).toBe("A1 ");
    expect(keyOf("Ab", "varchar")).toBe("Ab");
    expect(keyOf("ab  ", "nchar")).toBe("ab  ");
    expect(keyOf("x ", "char")).toBe("x ");
  });
  it("renders ints as decimal strings", () => {
    expect(keyOf(12, "int")).toBe("12");
    expect(keyOf("12", "smallint")).toBe("12");
    expect(keyOf(7, "tinyint")).toBe("7");
    expect(keyOf(-3, "int")).toBe("-3");
  });
  it("throws on non-integer int keys", () => {
    expect(() => keyOf(1.5, "int")).toThrow("keyOf: invalid integer key");
    expect(() => keyOf(NaN, "int")).toThrow("keyOf: invalid integer key");
    expect(() => keyOf("abc", "int")).toThrow("keyOf: invalid integer key");
    expect(() => keyOf(Infinity, "smallint")).toThrow("keyOf: invalid integer key");
  });
  it("throws on null/undefined keys", () => {
    expect(() => keyOf(null, "int")).toThrow("keyOf: null key");
    expect(() => keyOf(undefined, "nvarchar")).toThrow("keyOf: null key");
    expect(() => keyOf(null, "uniqueidentifier")).toThrow("keyOf: null key");
  });
});

describe("diffKeys", () => {
  it("classifies inserted / updated / deleted", () => {
    const source = [{ k: "1", h: "a" }, { k: "2", h: "b" }, { k: "4", h: "d" }];
    const target = [{ k: "1", h: "a" }, { k: "2", h: "x" }, { k: "3", h: "c" }];
    expect(diffKeys(source, target)).toEqual({ inserted: ["4"], updated: ["2"], deleted: ["3"] });
  });
  it("uuid casing differences do not produce delete + insert", () => {
    const src = [{ k: keyOf("ABCDEF00-0000-0000-0000-000000000001", "uniqueidentifier"), h: "a" }];
    const tgt = [{ k: keyOf("abcdef00-0000-0000-0000-000000000001", "uniqueidentifier"), h: "a" }];
    expect(diffKeys(src, tgt)).toEqual({ inserted: [], updated: [], deleted: [] });
  });
  it("duplicate source key counts once", () => {
    const r = diffKeys([{ k: "1", h: "a" }, { k: "1", h: "a" }], [{ k: "1", h: "a" }]);
    expect(r).toEqual({ inserted: [], updated: [], deleted: [] });
  });
  it("duplicate new source key is inserted once", () => {
    const r = diffKeys([{ k: "1", h: "a" }, { k: "1", h: "a" }], []);
    expect(r.inserted).toEqual(["1"]);
  });
  it("duplicate source key with differing hashes: last wins, listed once", () => {
    const r = diffKeys([{ k: "1", h: "a" }, { k: "1", h: "b" }], [{ k: "1", h: "a" }]);
    expect(r).toEqual({ inserted: [], updated: ["1"], deleted: [] });
    const r2 = diffKeys([{ k: "1", h: "b" }, { k: "1", h: "a" }], [{ k: "1", h: "a" }]);
    expect(r2).toEqual({ inserted: [], updated: [], deleted: [] });
  });
  it("duplicate target keys are listed once in deleted; last hash wins", () => {
    expect(diffKeys([], [{ k: "9", h: "a" }, { k: "9", h: "a" }]).deleted).toEqual(["9"]);
    const r = diffKeys([{ k: "1", h: "b" }], [{ k: "1", h: "a" }, { k: "1", h: "b" }]);
    expect(r).toEqual({ inserted: [], updated: [], deleted: [] });
  });
  it("preserves source order for inserted/updated and target order for deleted", () => {
    const source = [{ k: "z", h: "1" }, { k: "m", h: "2" }, { k: "a", h: "3" }, { k: "q", h: "new" }];
    const target = [{ k: "y", h: "1" }, { k: "m", h: "2" }, { k: "b", h: "1" }, { k: "q", h: "old" }];
    expect(diffKeys(source, target)).toEqual({
      inserted: ["z", "a"],
      updated: ["q"],
      deleted: ["y", "b"],
    });
  });
  it("handles empty inputs", () => {
    expect(diffKeys([], [])).toEqual({ inserted: [], updated: [], deleted: [] });
  });
});

describe("massDeleteGuard", () => {
  it("blocks wiping a large table", () => {
    expect(massDeleteGuard(19285, 19285)).toBe(true);
  });
  it("allows small deletes on a large table", () => {
    expect(massDeleteGuard(19285, 40)).toBe(false);
  });
  it("does not apply to tiny tables", () => {
    expect(massDeleteGuard(4, 4)).toBe(false);
  });
  it("uses strict comparisons", () => {
    expect(massDeleteGuard(100, 100)).toBe(false); // liveCount must be > 100
    expect(massDeleteGuard(101, 51)).toBe(true);
    expect(massDeleteGuard(200, 100)).toBe(false); // exactly 50% is allowed
    expect(massDeleteGuard(200, 101)).toBe(true);
  });
});
