"use server";

import { requireCapability } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { publications, auditLog } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publicationSchema } from "@/lib/validators";
import { deleteFile } from "@/lib/blob";
import type { Publication } from "@/types";

export async function getPublications(): Promise<Publication[]> {
  await requireCapability("cms.read");
  try {
    return await db.select().from(publications).orderBy(desc(publications.year));
  } catch {
    return [];
  }
}

export async function getPublication(id: number): Promise<Publication | null> {
  await requireCapability("cms.read");
  try {
    const [pub] = await db
      .select()
      .from(publications)
      .where(eq(publications.id, id))
      .limit(1);
    return pub ?? null;
  } catch {
    return null;
  }
}

export async function createPublication(formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    title: formData.get("title") as string,
    year: Number(formData.get("year") ?? new Date().getFullYear()),
    description: (formData.get("description") as string) || undefined,
    isPublished: formData.get("isPublished") === "true",
  };

  const validated = publicationSchema.parse(raw);

  const blobUrl = formData.get("blobUrl") as string;
  const blobPathname = formData.get("blobPathname") as string;
  const fileSizeBytes = formData.get("fileSizeBytes")
    ? Number(formData.get("fileSizeBytes"))
    : null;

  if (!blobUrl || !blobPathname) {
    throw new Error("A PDF file is required for publications.");
  }

  const [inserted] = await db
    .insert(publications)
    .values({
      title: validated.title,
      year: validated.year,
      description: validated.description || null,
      blobUrl,
      blobPathname,
      fileSizeBytes,
      isPublished: validated.isPublished,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "publication",
    entityId: inserted.id,
    details: { title: validated.title },
  });

  revalidatePath("/resources/publications");
  revalidatePath("/admin/publications");
  redirect("/admin/publications");
}

export async function updatePublication(id: number, formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    title: formData.get("title") as string,
    year: Number(formData.get("year") ?? new Date().getFullYear()),
    description: (formData.get("description") as string) || undefined,
    isPublished: formData.get("isPublished") === "true",
  };

  const validated = publicationSchema.parse(raw);

  const blobUrl = formData.get("blobUrl") as string;
  const blobPathname = formData.get("blobPathname") as string;
  const fileSizeBytes = formData.get("fileSizeBytes")
    ? Number(formData.get("fileSizeBytes"))
    : null;

  if (!blobUrl || !blobPathname) {
    throw new Error("A PDF file is required for publications.");
  }

  await db
    .update(publications)
    .set({
      title: validated.title,
      year: validated.year,
      description: validated.description || null,
      blobUrl,
      blobPathname,
      fileSizeBytes,
      isPublished: validated.isPublished,
      updatedAt: new Date(),
    })
    .where(eq(publications.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "publication",
    entityId: id,
    details: { title: validated.title },
  });

  revalidatePath("/resources/publications");
  revalidatePath("/admin/publications");
  redirect("/admin/publications");
}

export async function deletePublication(id: number) {
  const session = await requireCapability("cms.write");

  const [pub] = await db
    .select()
    .from(publications)
    .where(eq(publications.id, id))
    .limit(1);

  if (pub?.blobUrl) {
    try {
      await deleteFile(pub.blobUrl);
    } catch {
      // Continue
    }
  }

  await db.delete(publications).where(eq(publications.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "delete",
    entityType: "publication",
    entityId: id,
    details: { title: pub?.title },
  });

  revalidatePath("/resources/publications");
  revalidatePath("/admin/publications");
}
