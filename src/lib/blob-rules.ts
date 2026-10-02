// Folders the admin UI uploads into (see the `folder` prop of PdfUpload callers),
// plus the default used by uploadFile / uploadFileAction.
export const UPLOAD_FOLDERS: readonly string[] = [
  "documents",
  "board",
  "forms",
  "meetings",
  "images",
  "publications",
];

export function isAllowedFolder(folder: string): boolean {
  return UPLOAD_FOLDERS.includes(folder);
}

export function isAllowedBlobUrl(url: string): boolean {
  // URL parsing collapses dot segments, so check the raw string first.
  if (url.split(/[/\\?#]/).some((seg) => /^(\.|%2e){1,2}$/i.test(seg))) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (!u.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
  const first = u.pathname.split("/")[1] ?? "";
  return isAllowedFolder(first);
}

const UPLOAD_TYPES: Record<string, { type: string; matches: (h: Uint8Array) => boolean }> = {
  pdf: { type: "application/pdf", matches: (h) => startsWith(h, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  jpg: { type: "image/jpeg", matches: (h) => startsWith(h, [0xff, 0xd8, 0xff]) },
  jpeg: { type: "image/jpeg", matches: (h) => startsWith(h, [0xff, 0xd8, 0xff]) },
  png: {
    type: "image/png",
    matches: (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  webp: {
    type: "image/webp",
    matches: (h) =>
      startsWith(h, [0x52, 0x49, 0x46, 0x46]) &&
      h.length >= 12 &&
      startsWith(h.subarray(8), [0x57, 0x45, 0x42, 0x50]),
  },
};

function startsWith(head: Uint8Array, magic: number[]): boolean {
  return head.length >= magic.length && magic.every((b, i) => head[i] === b);
}

// The content type to store, decided from the last extension and the leading
// bytes (never the client-supplied type), or null if either is not allowed.
export function detectUploadType(fileName: string, head: Uint8Array): string | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  const rule = Object.hasOwn(UPLOAD_TYPES, fileName.slice(dot + 1).toLowerCase())
    ? UPLOAD_TYPES[fileName.slice(dot + 1).toLowerCase()]
    : undefined;
  return rule && rule.matches(head) ? rule.type : null;
}
