"use server";

import { requireCapability } from "@/lib/auth-utils";
import { uploadFile, deleteFile } from "@/lib/blob";
import { isAllowedBlobUrl, isAllowedFolder } from "@/lib/blob-rules";

export async function uploadFileAction(formData: FormData) {
  await requireCapability("cms.write");

  const file = formData.get("file") as File;
  const folder = (formData.get("folder") as string) || "documents";

  if (!file) throw new Error("No file provided");
  if (!isAllowedFolder(folder)) throw new Error("Invalid folder");

  const result = await uploadFile(file, folder);
  return result;
}

export async function deleteFileAction(blobUrl: string) {
  await requireCapability("cms.write");
  if (!isAllowedBlobUrl(blobUrl)) throw new Error("Invalid file");

  await deleteFile(blobUrl);
}
