import { put, del } from "@vercel/blob";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_PDF_TYPES = ["application/pdf"];
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadFile(file: File, folder: string = "documents") {
  if (![...ALLOWED_PDF_TYPES, ...ALLOWED_IMAGE_TYPES].includes(file.type)) {
    throw new Error("File type not allowed. Accepted: PDF, JPEG, PNG, WebP");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File must be less than 10MB");
  }
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const pathname = `${folder}/${timestamp}-${safeName}`;
  const blob = await put(pathname, file, { access: "public", addRandomSuffix: false });
  return { url: blob.url, pathname: blob.pathname, size: file.size };
}

export async function deleteFile(blobUrl: string) {
  await del(blobUrl);
}
