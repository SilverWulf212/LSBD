import { describe, it, expect } from "vitest";
import * as crypto from "node:crypto";
import { normalizeSsn, hmacSsn } from "../../scripts/lib/pii";

describe("normalizeSsn", () => {
  it("strips dashes to 9 digits", () => {
    expect(normalizeSsn("123-45-6789")).toBe("123456789");
  });
  it("returns null for too-short input", () => {
    expect(normalizeSsn("12345")).toBeNull();
  });
  it("returns null for null", () => {
    expect(normalizeSsn(null)).toBeNull();
  });
});

describe("hmacSsn", () => {
  it("matches crypto HMAC-SHA256 base64", () => {
    const key = Buffer.from("k");
    const expected = crypto.createHmac("sha256", key).update("123456789").digest("base64");
    expect(hmacSsn(key, "123456789")).toBe(expected);
  });
  it("is deterministic", () => {
    const key = Buffer.from("k");
    expect(hmacSsn(key, "123456789")).toBe(hmacSsn(key, "123456789"));
  });
});
