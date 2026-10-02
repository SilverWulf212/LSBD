import { describe, expect, it } from "vitest";
import { safeEmailHref, safeUrlHref } from "../../src/lib/staff-links";

describe("safeUrlHref", () => {
  it("allows http and https only", () => {
    expect(safeUrlHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrlHref(" http://example.com ")).toBe("http://example.com/");
  });
  it("refuses other schemes and junk", () => {
    for (const v of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "ftp://x.org", "www.example.com", "", null]) {
      expect(safeUrlHref(v), String(v)).toBeNull();
    }
  });
});

describe("safeEmailHref", () => {
  it("builds mailto from an address-looking value", () => {
    expect(safeEmailHref(" a.b@example.org ")).toBe("mailto:a.b@example.org");
  });
  it("refuses everything else", () => {
    for (const v of ["javascript:alert(1)", "a@b", "a b@example.org", "mailto:a@example.org", "a@example.org?cc=x", "", null]) {
      expect(safeEmailHref(v), String(v)).toBeNull();
    }
  });
});
