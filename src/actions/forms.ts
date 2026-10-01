"use server";

import { requireCapability } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { downloadableForms, auditLog } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formEntrySchema } from "@/lib/validators";
import { deleteFile } from "@/lib/blob";
import type { DownloadableForm } from "@/types";

export async function getForms(): Promise<DownloadableForm[]> {
  await requireCapability("cms.read");
  try {
    return await db
      .select()
      .from(downloadableForms)
      .orderBy(asc(downloadableForms.category), asc(downloadableForms.sortOrder));
  } catch {
    return [];
  }
}

export async function getForm(id: number): Promise<DownloadableForm | null> {
  await requireCapability("cms.read");
  try {
    const [form] = await db
      .select()
      .from(downloadableForms)
      .where(eq(downloadableForms.id, id))
      .limit(1);
    return form ?? null;
  } catch {
    return null;
  }
}

export async function createForm(formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    category: formData.get("category") as string,
    isExternal: formData.get("isExternal") === "true",
    externalUrl: (formData.get("externalUrl") as string) || undefined,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isActive: formData.get("isActive") === "true",
  };

  const validated = formEntrySchema.parse(raw);

  const blobUrl = (formData.get("blobUrl") as string) || null;
  const blobPathname = (formData.get("blobPathname") as string) || null;
  const fileSizeBytes = formData.get("fileSizeBytes")
    ? Number(formData.get("fileSizeBytes"))
    : null;

  const [inserted] = await db
    .insert(downloadableForms)
    .values({
      name: validated.name,
      description: validated.description || null,
      category: validated.category,
      isExternal: validated.isExternal,
      externalUrl: validated.externalUrl || null,
      blobUrl,
      blobPathname,
      fileSizeBytes,
      sortOrder: validated.sortOrder,
      isActive: validated.isActive,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "form",
    entityId: inserted.id,
    details: { name: validated.name },
  });

  revalidatePath("/resources/forms");
  revalidatePath("/admin/forms");
  redirect("/admin/forms");
}

export async function updateForm(id: number, formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    category: formData.get("category") as string,
    isExternal: formData.get("isExternal") === "true",
    externalUrl: (formData.get("externalUrl") as string) || undefined,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isActive: formData.get("isActive") === "true",
  };

  const validated = formEntrySchema.parse(raw);

  const blobUrl = (formData.get("blobUrl") as string) || null;
  const blobPathname = (formData.get("blobPathname") as string) || null;
  const fileSizeBytes = formData.get("fileSizeBytes")
    ? Number(formData.get("fileSizeBytes"))
    : null;

  await db
    .update(downloadableForms)
    .set({
      name: validated.name,
      description: validated.description || null,
      category: validated.category,
      isExternal: validated.isExternal,
      externalUrl: validated.externalUrl || null,
      blobUrl,
      blobPathname,
      fileSizeBytes,
      sortOrder: validated.sortOrder,
      isActive: validated.isActive,
      updatedAt: new Date(),
    })
    .where(eq(downloadableForms.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "form",
    entityId: id,
    details: { name: validated.name },
  });

  revalidatePath("/resources/forms");
  revalidatePath("/admin/forms");
  redirect("/admin/forms");
}

export async function deleteForm(id: number) {
  const session = await requireCapability("cms.write");

  const [form] = await db
    .select()
    .from(downloadableForms)
    .where(eq(downloadableForms.id, id))
    .limit(1);

  if (form?.blobUrl) {
    try {
      await deleteFile(form.blobUrl);
    } catch {
      // Continue
    }
  }

  await db.delete(downloadableForms).where(eq(downloadableForms.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "delete",
    entityType: "form",
    entityId: id,
    details: { name: form?.name },
  });

  revalidatePath("/resources/forms");
  revalidatePath("/admin/forms");
}
