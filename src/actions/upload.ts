"use server";

import { auth } from "@/lib/auth";
import { uploadFile, deleteFile } from "@/lib/blob";

export async function uploadFileAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const file = formData.get("file") as File;
  const folder = (formData.get("folder") as string) || "documents";

  if (!file) throw new Error("No file provided");

  const result = await uploadFile(file, folder);
  return result;
}

export async function deleteFileAction(blobUrl: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await deleteFile(blobUrl);
}
