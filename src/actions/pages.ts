"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageSections, auditLog } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { pageSectionSchema } from "@/lib/validators";
import type { PageSection } from "@/types";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function getPageSections(): Promise<PageSection[]> {
  try {
    return await db
      .select()
      .from(pageSections)
      .orderBy(asc(pageSections.pageSlug), asc(pageSections.sortOrder));
  } catch {
    return [];
  }
}

export async function getPageSectionsBySlug(pageSlug: string): Promise<PageSection[]> {
  try {
    return await db
      .select()
      .from(pageSections)
      .where(eq(pageSections.pageSlug, pageSlug))
      .orderBy(asc(pageSections.sortOrder));
  } catch {
    return [];
  }
}

export async function getPageSection(id: number): Promise<PageSection | null> {
  try {
    const [section] = await db
      .select()
      .from(pageSections)
      .where(eq(pageSections.id, id))
      .limit(1);
    return section ?? null;
  } catch {
    return null;
  }
}

export async function updatePageSection(id: number, formData: FormData) {
  const session = await requireSession();
  const raw = {
    pageSlug: formData.get("pageSlug") as string,
    sectionKey: formData.get("sectionKey") as string,
    title: (formData.get("title") as string) || undefined,
    content: formData.get("content") as string,
  };

  const validated = pageSectionSchema.parse(raw);

  // Check if section exists
  const [existing] = await db
    .select()
    .from(pageSections)
    .where(eq(pageSections.id, id))
    .limit(1);

  if (existing) {
    await db
      .update(pageSections)
      .set({
        title: validated.title || null,
        content: validated.content,
        updatedAt: new Date(),
        updatedBy: Number(session.user.id),
      })
      .where(eq(pageSections.id, id));
  } else {
    // Upsert: create if not exists
    await db.insert(pageSections).values({
      pageSlug: validated.pageSlug,
      sectionKey: validated.sectionKey,
      title: validated.title || null,
      content: validated.content,
      updatedBy: Number(session.user.id),
    });
  }

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "page_section",
    entityId: id,
    details: {
      pageSlug: validated.pageSlug,
      sectionKey: validated.sectionKey,
    },
  });

  revalidatePath(`/${validated.pageSlug}`);
  revalidatePath("/admin/pages");
}

/**
 * Returns a list of unique page slugs that have sections.
 */
export async function getPageSlugs(): Promise<string[]> {
  try {
    const sections = await db
      .select({ pageSlug: pageSections.pageSlug })
      .from(pageSections)
      .groupBy(pageSections.pageSlug)
      .orderBy(asc(pageSections.pageSlug));
    return sections.map((s) => s.pageSlug);
  } catch {
    return [];
  }
}
