"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { boardMembers, auditLog } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { boardMemberSchema } from "@/lib/validators";
import type { BoardMember } from "@/types";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function getBoardMembers(): Promise<BoardMember[]> {
  try {
    return await db.select().from(boardMembers).orderBy(asc(boardMembers.sortOrder));
  } catch {
    return [];
  }
}

export async function getBoardMember(id: number): Promise<BoardMember | null> {
  try {
    const [member] = await db.select().from(boardMembers).where(eq(boardMembers.id, id)).limit(1);
    return member ?? null;
  } catch {
    return null;
  }
}

export async function createBoardMember(formData: FormData) {
  const session = await requireSession();
  const raw = {
    name: formData.get("name") as string,
    honorific: (formData.get("honorific") as string) || undefined,
    credential: (formData.get("credential") as string) || undefined,
    role: formData.get("role") as string,
    district: (formData.get("district") as string) || undefined,
    imageUrl: (formData.get("imageUrl") as string) || undefined,
    isActive: formData.get("isActive") === "true",
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  };

  const validated = boardMemberSchema.parse(raw);

  const [inserted] = await db
    .insert(boardMembers)
    .values({
      name: validated.name,
      honorific: validated.honorific || null,
      credential: validated.credential || null,
      role: validated.role,
      district: validated.district || null,
      imageUrl: validated.imageUrl || null,
      isActive: validated.isActive,
      sortOrder: validated.sortOrder,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "board_member",
    entityId: inserted.id,
    details: { name: validated.name },
  });

  revalidatePath("/about/board");
  revalidatePath("/admin/board");
  redirect("/admin/board");
}

export async function updateBoardMember(id: number, formData: FormData) {
  const session = await requireSession();
  const raw = {
    name: formData.get("name") as string,
    honorific: (formData.get("honorific") as string) || undefined,
    credential: (formData.get("credential") as string) || undefined,
    role: formData.get("role") as string,
    district: (formData.get("district") as string) || undefined,
    imageUrl: (formData.get("imageUrl") as string) || undefined,
    isActive: formData.get("isActive") === "true",
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  };

  const validated = boardMemberSchema.parse(raw);

  await db
    .update(boardMembers)
    .set({
      name: validated.name,
      honorific: validated.honorific || null,
      credential: validated.credential || null,
      role: validated.role,
      district: validated.district || null,
      imageUrl: validated.imageUrl || null,
      isActive: validated.isActive,
      sortOrder: validated.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(boardMembers.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "board_member",
    entityId: id,
    details: { name: validated.name },
  });

  revalidatePath("/about/board");
  revalidatePath("/admin/board");
  redirect("/admin/board");
}

export async function deleteBoardMember(id: number) {
  const session = await requireSession();

  const [member] = await db
    .select({ name: boardMembers.name })
    .from(boardMembers)
    .where(eq(boardMembers.id, id))
    .limit(1);

  await db.delete(boardMembers).where(eq(boardMembers.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "delete",
    entityType: "board_member",
    entityId: id,
    details: { name: member?.name },
  });

  revalidatePath("/about/board");
  revalidatePath("/admin/board");
}

export async function getBoardMembersCount(): Promise<number> {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(boardMembers)
      .where(eq(boardMembers.isActive, true));
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}
