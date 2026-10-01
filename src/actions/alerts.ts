"use server";

import { requireCapability } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { alerts, auditLog } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { alertSchema } from "@/lib/validators";
import type { Alert } from "@/types";

export async function getAlerts(): Promise<Alert[]> {
  await requireCapability("cms.read");
  try {
    return await db.select().from(alerts).orderBy(desc(alerts.createdAt));
  } catch {
    return [];
  }
}

export async function getAlert(id: number): Promise<Alert | null> {
  await requireCapability("cms.read");
  try {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    return alert ?? null;
  } catch {
    return null;
  }
}

export async function createAlert(formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    title: formData.get("title") as string,
    content: formData.get("content") as string,
    severity: formData.get("severity") as "info" | "warning" | "critical",
    isActive: formData.get("isActive") === "true",
    startsAt: (formData.get("startsAt") as string) || undefined,
    endsAt: (formData.get("endsAt") as string) || undefined,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  };

  const validated = alertSchema.parse(raw);

  const [inserted] = await db
    .insert(alerts)
    .values({
      title: validated.title,
      content: validated.content,
      severity: validated.severity,
      isActive: validated.isActive,
      startsAt: validated.startsAt ? new Date(validated.startsAt) : null,
      endsAt: validated.endsAt ? new Date(validated.endsAt) : null,
      sortOrder: validated.sortOrder,
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "alert",
    entityId: inserted.id,
    details: { title: validated.title },
  });

  revalidatePath("/");
  revalidatePath("/admin/alerts");
  redirect("/admin/alerts");
}

export async function updateAlert(id: number, formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    title: formData.get("title") as string,
    content: formData.get("content") as string,
    severity: formData.get("severity") as "info" | "warning" | "critical",
    isActive: formData.get("isActive") === "true",
    startsAt: (formData.get("startsAt") as string) || undefined,
    endsAt: (formData.get("endsAt") as string) || undefined,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  };

  const validated = alertSchema.parse(raw);

  await db
    .update(alerts)
    .set({
      title: validated.title,
      content: validated.content,
      severity: validated.severity,
      isActive: validated.isActive,
      startsAt: validated.startsAt ? new Date(validated.startsAt) : null,
      endsAt: validated.endsAt ? new Date(validated.endsAt) : null,
      sortOrder: validated.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "alert",
    entityId: id,
    details: { title: validated.title },
  });

  revalidatePath("/");
  revalidatePath("/admin/alerts");
  redirect("/admin/alerts");
}

export async function deleteAlert(id: number) {
  const session = await requireCapability("cms.write");

  const [alert] = await db
    .select({ title: alerts.title })
    .from(alerts)
    .where(eq(alerts.id, id))
    .limit(1);

  await db.delete(alerts).where(eq(alerts.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "delete",
    entityType: "alert",
    entityId: id,
    details: { title: alert?.title },
  });

  revalidatePath("/");
  revalidatePath("/admin/alerts");
}

export async function getActiveAlertsCount(): Promise<number> {
  await requireCapability("cms.read");
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(eq(alerts.isActive, true));
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}
