import { describe, expect, it } from "vitest";
import { UPLOAD_FOLDERS, detectUploadType, isAllowedBlobUrl, isAllowedBlobUrlOnUpdate, isAllowedFolder } from "../../src/lib/blob-rules";

const host = "https://abc123.public.blob.vercel-storage.com";
describe("blob rules", () => {
  it("accepts a known folder on the blob host", () => {
    expect(isAllowedBlobUrl(`${host}/${UPLOAD_FOLDERS[0]}/file.pdf`)).toBe(true);
  });
  it("rejects other hosts, http, unknown folders, traversal and junk", () => {
    expect(isAllowedBlobUrl(`https://evil.example/${UPLOAD_FOLDERS[0]}/x.pdf`)).toBe(false);
    expect(isAllowedBlobUrl(`http://abc123.public.blob.vercel-storage.com/${UPLOAD_FOLDERS[0]}/x.pdf`)).toBe(false);
    expect(isAllowedBlobUrl(`${host}/secret/x.pdf`)).toBe(false);
    expect(isAllowedBlobUrl(`${host}/../${UPLOAD_FOLDERS[0]}/x.pdf`)).toBe(false);
    expect(isAllowedBlobUrl("not a url")).toBe(false);
  });
  it("folder allow-list", () => {
    expect(isAllowedFolder("documents")).toBe(true);
    expect(isAllowedFolder("../documents")).toBe(false);
    expect(isAllowedFolder("")).toBe(false);
  });

  describe("detectUploadType", () => {
    const bytes = (s: string) => new TextEncoder().encode(s);
    const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
    const WEBP = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03, 0x04, 0x57, 0x45, 0x42, 0x50,
    ]);

    it("accepts a PDF whose bytes match, ignoring extension case", () => {
      expect(detectUploadType("a.pdf", bytes("%PDF-1.7"))).toBe("application/pdf");
      expect(detectUploadType("REPORT.PDF", bytes("%PDF-1.4"))).toBe("application/pdf");
    });
    it("rejects HTML named .pdf", () => {
      expect(detectUploadType("a.pdf", bytes("<html><script>"))).toBeNull();
    });
    it("accepts images whose bytes match", () => {
      expect(detectUploadType("a.png", PNG)).toBe("image/png");
      expect(detectUploadType("a.jpg", JPEG)).toBe("image/jpeg");
      expect(detectUploadType("a.jpeg", JPEG)).toBe("image/jpeg");
      expect(detectUploadType("a.webp", WEBP)).toBe("image/webp");
    });
    it("requires extension and content to agree", () => {
      expect(detectUploadType("a.png", JPEG)).toBeNull();
    });
    it("rejects other extensions, no extension, and a final .exe", () => {
      expect(detectUploadType("page.html", bytes("<html>"))).toBeNull();
      expect(detectUploadType("a.svg", bytes("<svg"))).toBeNull();
      expect(detectUploadType("noextension", bytes("%PDF-1.7"))).toBeNull();
      expect(detectUploadType("a.pdf.exe", bytes("%PDF-1.7"))).toBeNull();
    });
    it("rejects empty content", () => {
      expect(detectUploadType("a.pdf", new Uint8Array())).toBeNull();
    });
  });
});

describe("isAllowedBlobUrlOnUpdate", () => {
  it("keeps an unchanged stored value, including the seed placeholder", () => {
    expect(isAllowedBlobUrlOnUpdate("#", "#")).toBe(true);
  });
  it("rejects a changed value that is not one of our blob URLs", () => {
    expect(isAllowedBlobUrlOnUpdate("#", `${host}/forms/a.pdf`)).toBe(false);
    expect(isAllowedBlobUrlOnUpdate("https://evil.example/forms/a.pdf", "#")).toBe(false);
    expect(isAllowedBlobUrlOnUpdate("#", null)).toBe(false);
  });
  it("accepts a new blob URL", () => {
    expect(isAllowedBlobUrlOnUpdate(`${host}/forms/a.pdf`, "#")).toBe(true);
  });
});
