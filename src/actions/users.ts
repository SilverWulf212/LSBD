"use server";

import { hash } from "bcryptjs";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, auditLog } from "@/lib/db/schema";
import { requireCapability } from "@/lib/auth-utils";
import { userCreateSchema, userUpdateSchema } from "@/lib/validators";
import type { SafeUser } from "@/types";

// Never the password hash: these rows are passed to client components.
const safeUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export async function getUsers(): Promise<SafeUser[]> {
  await requireCapability("users.manage");
  try {
    return await db.select(safeUserColumns).from(users).orderBy(desc(users.createdAt));
  } catch {
    return [];
  }
}

export async function getUser(id: number): Promise<SafeUser | null> {
  await requireCapability("users.manage");
  try {
    const [user] = await db.select(safeUserColumns).from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

export async function createUser(formData: FormData) {
  const session = await requireCapability("users.manage");
  const raw = {
    email: formData.get("email") as string,
    name: formData.get("name") as string,
    role: formData.get("role") as string,
    password: formData.get("password") as string,
  };

  const validated = userCreateSchema.parse(raw);
  const passwordHash = await hash(validated.password, 10);

  const [inserted] = await db
    .insert(users)
    .values({
      email: validated.email,
      name: validated.name,
      role: validated.role,
      passwordHash,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "user",
    entityId: inserted.id,
    details: { email: validated.email, role: validated.role },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUser(id: number, formData: FormData) {
  const session = await requireCapability("users.manage");
  const raw = {
    email: formData.get("email") as string,
    name: formData.get("name") as string,
    role: formData.get("role") as string,
    password: (formData.get("password") as string) || undefined,
  };

  const validated = userUpdateSchema.parse(raw);

  const updates: Partial<typeof users.$inferInsert> = {
    email: validated.email,
    name: validated.name,
    role: validated.role,
    updatedAt: new Date(),
  };
  if (validated.password) {
    updates.passwordHash = await hash(validated.password, 10);
  }

  await db.update(users).set(updates).where(eq(users.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "user",
    entityId: id,
    details: {
      email: validated.email,
      role: validated.role,
      passwordChanged: !!validated.password,
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function deleteUser(id: number) {
  const session = await requireCapability("users.manage");

  if (Number(session.user.id) === id) {
    throw new Error("You cannot delete your own account.");
  }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  await db.delete(users).where(eq(users.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "delete",
    entityType: "user",
    entityId: id,
    details: { email: user?.email },
  });

  revalidatePath("/admin/users");
}
