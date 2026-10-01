import { describe, expect, it } from "vitest";
import { anonRestOutcome } from "../../scripts/lib/anon-rest-outcome";

describe("anonRestOutcome", () => {
  it("passes on permission denied, hidden or not", () => {
    expect(anonRestOutcome(false, { code: "42501" }, null)).toBe("pass");
    expect(anonRestOutcome(true, { code: "42501" }, null)).toBe("pass");
  });

  it("passes on zero rows and fails on visible rows", () => {
    expect(anonRestOutcome(false, null, 0)).toBe("pass");
    expect(anonRestOutcome(true, null, 0)).toBe("pass");
    expect(anonRestOutcome(false, null, 3)).toBe("fail");
    expect(anonRestOutcome(true, null, 13004)).toBe("fail");
  });

  it("fails when no error and no count came back", () => {
    expect(anonRestOutcome(false, null, null)).toBe("fail");
    expect(anonRestOutcome(true, null, null)).toBe("fail");
  });

  it("passes relation-not-found only for a relation expected to be hidden", () => {
    expect(anonRestOutcome(true, { code: "PGRST205" }, null)).toBe("pass");
    expect(anonRestOutcome(true, { code: "42P01" }, null)).toBe("pass");
    expect(anonRestOutcome(false, { code: "PGRST205" }, null)).toBe("fail");
    expect(anonRestOutcome(false, { code: "42P01" }, null)).toBe("fail");
  });

  it("fails on any other error", () => {
    expect(anonRestOutcome(true, { code: "PGRST301" }, null)).toBe("fail");
    expect(anonRestOutcome(false, { code: "57014" }, null)).toBe("fail");
    expect(anonRestOutcome(true, {}, null)).toBe("fail");
    expect(anonRestOutcome(false, { code: "" }, 0)).toBe("fail");
  });
});
