import { describe, expect, it } from "vitest";
import { PERMISSIONS_POLICY, blobHostFromToken, buildCsp } from "../../src/lib/security-headers";

const WILDCARD = "*.public.blob.vercel-storage.com";

describe("blobHostFromToken", () => {
  it("derives the lower-cased store host from a read-write token", () => {
    expect(blobHostFromToken("vercel_blob_rw_AbC123_secret")).toBe("abc123.public.blob.vercel-storage.com");
  });
  it("falls back to the wildcard for unusable tokens", () => {
    expect(blobHostFromToken(undefined)).toBe(WILDCARD);
    expect(blobHostFromToken("")).toBe(WILDCARD);
    expect(blobHostFromToken("something_else_AbC123_secret_x")).toBe(WILDCARD);
    expect(blobHostFromToken("vercel_blob_rw_AbC123")).toBe(WILDCARD);
    expect(blobHostFromToken("vercel_blob_rw__secret_x")).toBe(WILDCARD);
    expect(blobHostFromToken("vercel_blob_rw_a-b.c_secret_x")).toBe(WILDCARD);
  });
});

describe("buildCsp", () => {
  const prod = buildCsp({ isDev: false, blobHost: "abc.public.blob.vercel-storage.com" });
  const directive = (csp: string, name: string) =>
    csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

  it("drops unsafe-eval in production but keeps unsafe-inline", () => {
    const script = directive(prod, "script-src");
    expect(script).toContain("'self'");
    expect(script).toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });
  it("adds the locked-down directives", () => {
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toContain("frame-ancestors 'none'");
  });
  it("pins img-src to the given blob host with no wildcard", () => {
    const img = directive(prod, "img-src");
    expect(img).toContain("https://abc.public.blob.vercel-storage.com");
    expect(img).not.toContain("*");
  });
  it("allows unsafe-eval in development", () => {
    expect(buildCsp({ isDev: true, blobHost: "abc.public.blob.vercel-storage.com" })).toContain("'unsafe-eval'");
  });
  it("keeps every directive that was already present", () => {
    expect(prod).toContain("default-src 'self'");
    expect(prod).toContain("style-src 'self' 'unsafe-inline'");
    expect(prod).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(prod).toContain("connect-src 'self'");
    expect(prod).toContain("img-src 'self' data: blob:");
  });
});

describe("PERMISSIONS_POLICY", () => {
  it("disables camera, microphone and geolocation", () => {
    expect(PERMISSIONS_POLICY).toBe("camera=(), microphone=(), geolocation=()");
  });
});
