"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { staffMembers, auditLog } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { staffSchema } from "@/lib/validators";
import type { StaffMember } from "@/types";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session as typeof session & { user: NonNullable<typeof session.user> };
}

export async function getStaff(): Promise<StaffMember[]> {
  try {
    return await db
      .select()
      .from(staffMembers)
      .orderBy(asc(staffMembers.sortOrder));
  } catch {
    return [];
  }
}

export async function getStaffMember(id: number): Promise<StaffMember | null> {
  try {
    const [member] = await db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.id, id))
      .limit(1);
    return member ?? null;
  } catch {
    return null;
  }
}

export async function createStaff(formData: FormData) {
  const session = await requireSession();
  const raw = {
    name: formData.get("name") as string,
    title: formData.get("title") as string,
    email: formData.get("email") as string,
    responsibilities: (formData.get("responsibilities") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isActive: formData.get("isActive") === "true",
  };

  const validated = staffSchema.parse(raw);

  const [inserted] = await db
    .insert(staffMembers)
    .values({
      name: validated.name,
      title: validated.title,
      email: validated.email,
      responsibilities: validated.responsibilities || null,
      phone: validated.phone || null,
      sortOrder: validated.sortOrder,
      isActive: validated.isActive,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "staff",
    entityId: inserted.id,
    details: { name: validated.name },
  });

  revalidatePath("/about/staff");
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function updateStaff(id: number, formData: FormData) {
  const session = await requireSession();
  const raw = {
    name: formData.get("name") as string,
    title: formData.get("title") as string,
    email: formData.get("email") as string,
    responsibilities: (formData.get("responsibilities") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isActive: formData.get("isActive") === "true",
  };

  const validated = staffSchema.parse(raw);

  await db
    .update(staffMembers)
    .set({
      name: validated.name,
      title: validated.title,
      email: validated.email,
      responsibilities: validated.responsibilities || null,
      phone: validated.phone || null,
      sortOrder: validated.sortOrder,
      isActive: validated.isActive,
      updatedAt: new Date(),
    })
    .where(eq(staffMembers.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "staff",
    entityId: id,
    details: { name: validated.name },
  });

  revalidatePath("/about/staff");
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function deleteStaff(id: number) {
  const session = await requireSession();

  const [member] = await db
    .select({ name: staffMembers.name })
    .from(staffMembers)
    .where(eq(staffMembers.id, id))
    .limit(1);

  await db.delete(staffMembers).where(eq(staffMembers.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "delete",
    entityType: "staff",
    entityId: id,
    details: { name: member?.name },
  });

  revalidatePath("/about/staff");
  revalidatePath("/admin/staff");
}
