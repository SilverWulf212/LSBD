import { put, del } from "@vercel/blob";
import { detectUploadType } from "@/lib/blob-rules";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadFile(file: File, folder: string = "documents") {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = detectUploadType(file.name, head);
  if (!type) {
    throw new Error("File type not allowed. Accepted: PDF, JPEG, PNG, WebP");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File must be less than 10MB");
  }
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const pathname = `${folder}/${timestamp}-${safeName}`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: type,
    addRandomSuffix: true,
  });
  return { url: blob.url, pathname: blob.pathname, size: file.size };
}

export async function deleteFile(blobUrl: string) {
  await del(blobUrl);
}
