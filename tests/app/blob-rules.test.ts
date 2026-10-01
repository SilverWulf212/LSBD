import { describe, expect, it } from "vitest";
import { UPLOAD_FOLDERS, isAllowedBlobUrl, isAllowedFolder } from "../../src/lib/blob-rules";

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
});
