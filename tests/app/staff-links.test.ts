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

describe("hostile stored values", () => {
  const HOSTILE = [
    " JavaScript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "//evil.example", "vbscript:x",
    "data:text/html,x", "www.example.com", "a@b.com%0Acc:x", "a@b.com%0Abcc%3Ax%40y.org", "a@b.com,x@y.org",
    "a@b.com?bcc=x@y.com",
  ];
  it("never become an e-mail or web href", () => {
    for (const v of HOSTILE) {
      expect(safeEmailHref(v), v).toBeNull();
      expect(safeUrlHref(v), v).toBeNull();
    }
  });
  it("plain good values still link", () => {
    expect(safeUrlHref("https://example.com/x")).toBe("https://example.com/x");
    expect(safeEmailHref("a@b.com")).toBe("mailto:a@b.com");
  });
});
