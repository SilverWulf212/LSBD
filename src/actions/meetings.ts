"use server";

import { requireCapability } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { meetings, meetingDocuments, auditLog } from "@/lib/db/schema";
import { eq, desc, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { meetingSchema } from "@/lib/validators";
import { deleteFile } from "@/lib/blob";
import type { MeetingWithDocuments } from "@/types";

export async function getMeetings(): Promise<MeetingWithDocuments[]> {
  await requireCapability("cms.read");
  try {
    const allMeetings = await db
      .select()
      .from(meetings)
      .orderBy(desc(meetings.meetingDate));
    const allDocs = await db.select().from(meetingDocuments);

    return allMeetings.map((m) => ({
      ...m,
      documents: allDocs.filter((d) => d.meetingId === m.id),
    }));
  } catch {
    return [];
  }
}

export async function getMeeting(id: number): Promise<MeetingWithDocuments | null> {
  await requireCapability("cms.read");
  try {
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);
    if (!meeting) return null;

    const docs = await db
      .select()
      .from(meetingDocuments)
      .where(eq(meetingDocuments.meetingId, id));

    return { ...meeting, documents: docs };
  } catch {
    return null;
  }
}

export async function createMeeting(formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    title: formData.get("title") as string,
    meetingDate: formData.get("meetingDate") as string,
    description: (formData.get("description") as string) || undefined,
    meetingType: formData.get("meetingType") as string,
    isPublished: formData.get("isPublished") === "true",
  };

  const validated = meetingSchema.parse(raw);

  const [inserted] = await db
    .insert(meetings)
    .values({
      title: validated.title,
      meetingDate: new Date(validated.meetingDate),
      description: validated.description || null,
      meetingType: validated.meetingType,
      isPublished: validated.isPublished,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "meeting",
    entityId: inserted.id,
    details: { title: validated.title },
  });

  revalidatePath("/resources/meetings");
  revalidatePath("/admin/meetings");
  redirect(`/admin/meetings/${inserted.id}/edit`);
}

export async function updateMeeting(id: number, formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    title: formData.get("title") as string,
    meetingDate: formData.get("meetingDate") as string,
    description: (formData.get("description") as string) || undefined,
    meetingType: formData.get("meetingType") as string,
    isPublished: formData.get("isPublished") === "true",
  };

  const validated = meetingSchema.parse(raw);

  await db
    .update(meetings)
    .set({
      title: validated.title,
      meetingDate: new Date(validated.meetingDate),
      description: validated.description || null,
      meetingType: validated.meetingType,
      isPublished: validated.isPublished,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "meeting",
    entityId: id,
    details: { title: validated.title },
  });

  revalidatePath("/resources/meetings");
  revalidatePath("/admin/meetings");
  redirect("/admin/meetings");
}

export async function deleteMeeting(id: number) {
  const session = await requireCapability("cms.write");

  const [meeting] = await db
    .select({ title: meetings.title })
    .from(meetings)
    .where(eq(meetings.id, id))
    .limit(1);

  // Delete associated documents from blob storage
  const docs = await db
    .select()
    .from(meetingDocuments)
    .where(eq(meetingDocuments.meetingId, id));

  for (const doc of docs) {
    try {
      await deleteFile(doc.blobUrl);
    } catch {
      // Continue even if blob deletion fails
    }
  }

  // Cascade delete handles meetingDocuments
  await db.delete(meetings).where(eq(meetings.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "delete",
    entityType: "meeting",
    entityId: id,
    details: { title: meeting?.title },
  });

  revalidatePath("/resources/meetings");
  revalidatePath("/admin/meetings");
}

export async function addMeetingDocument(
  meetingId: number,
  docType: "notice" | "agenda" | "minutes",
  fileData: { url: string; pathname: string; size: number; title: string }
) {
  const session = await requireCapability("cms.write");

  // Remove existing document of same type if present
  const existing = await db
    .select()
    .from(meetingDocuments)
    .where(eq(meetingDocuments.meetingId, meetingId));

  const existingDoc = existing.find((d) => d.docType === docType);
  if (existingDoc) {
    try {
      await deleteFile(existingDoc.blobUrl);
    } catch {
      // Continue
    }
    await db.delete(meetingDocuments).where(eq(meetingDocuments.id, existingDoc.id));
  }

  const [inserted] = await db
    .insert(meetingDocuments)
    .values({
      meetingId,
      docType,
      title: fileData.title,
      blobUrl: fileData.url,
      blobPathname: fileData.pathname,
      fileSizeBytes: fileData.size,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "meeting_document",
    entityId: inserted.id,
    details: { meetingId, docType, title: fileData.title },
  });

  revalidatePath("/resources/meetings");
  revalidatePath(`/admin/meetings/${meetingId}/edit`);
}

export async function deleteMeetingDocument(docId: number) {
  const session = await requireCapability("cms.write");

  const [doc] = await db
    .select()
    .from(meetingDocuments)
    .where(eq(meetingDocuments.id, docId))
    .limit(1);

  if (doc) {
    try {
      await deleteFile(doc.blobUrl);
    } catch {
      // Continue
    }
    await db.delete(meetingDocuments).where(eq(meetingDocuments.id, docId));

    await db.insert(auditLog).values({
      userId: Number(session.user.id),
      action: "delete",
      entityType: "meeting_document",
      entityId: docId,
      details: { meetingId: doc.meetingId, docType: doc.docType },
    });

    revalidatePath("/resources/meetings");
    revalidatePath(`/admin/meetings/${doc.meetingId}/edit`);
  }
}

export async function getUpcomingMeetingsCount(): Promise<number> {
  await requireCapability("cms.read");
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(meetings)
      .where(gte(meetings.meetingDate, new Date()));
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}
