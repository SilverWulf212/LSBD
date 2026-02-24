"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fees, auditLog } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { feeSchema } from "@/lib/validators";
import type { Fee } from "@/types";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session as typeof session & { user: NonNullable<typeof session.user> };
}

export async function getFees(): Promise<Fee[]> {
  try {
    return await db.select().from(fees).orderBy(asc(fees.category), asc(fees.sortOrder));
  } catch {
    return [];
  }
}

export async function getFee(id: number): Promise<Fee | null> {
  try {
    const [fee] = await db.select().from(fees).where(eq(fees.id, id)).limit(1);
    return fee ?? null;
  } catch {
    return null;
  }
}

export async function createFee(formData: FormData) {
  const session = await requireSession();
  const raw = {
    category: formData.get("category") as string,
    name: formData.get("name") as string,
    amount: Number(formData.get("amount") ?? 0),
    description: (formData.get("description") as string) || undefined,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isActive: formData.get("isActive") === "true",
  };

  const validated = feeSchema.parse(raw);

  const [inserted] = await db
    .insert(fees)
    .values({
      category: validated.category,
      name: validated.name,
      amount: validated.amount,
      description: validated.description || null,
      sortOrder: validated.sortOrder,
      isActive: validated.isActive,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "fee",
    entityId: inserted.id,
    details: { name: validated.name },
  });

  revalidatePath("/resources/fees");
  revalidatePath("/admin/fees");
}

export async function updateFee(id: number, formData: FormData) {
  const session = await requireSession();
  const raw = {
    category: formData.get("category") as string,
    name: formData.get("name") as string,
    amount: Number(formData.get("amount") ?? 0),
    description: (formData.get("description") as string) || undefined,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isActive: formData.get("isActive") === "true",
  };

  const validated = feeSchema.parse(raw);

  await db
    .update(fees)
    .set({
      category: validated.category,
      name: validated.name,
      amount: validated.amount,
      description: validated.description || null,
      sortOrder: validated.sortOrder,
      isActive: validated.isActive,
      updatedAt: new Date(),
    })
    .where(eq(fees.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "fee",
    entityId: id,
    details: { name: validated.name },
  });

  revalidatePath("/resources/fees");
  revalidatePath("/admin/fees");
}

export async function deleteFee(id: number) {
  const session = await requireSession();

  const [fee] = await db
    .select({ name: fees.name })
    .from(fees)
    .where(eq(fees.id, id))
    .limit(1);

  await db.delete(fees).where(eq(fees.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "delete",
    entityType: "fee",
    entityId: id,
    details: { name: fee?.name },
  });

  revalidatePath("/resources/fees");
  revalidatePath("/admin/fees");
}
