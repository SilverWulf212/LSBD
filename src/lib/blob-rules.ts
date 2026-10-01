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
