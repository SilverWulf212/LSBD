"use server";

import { requireCapability } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import type { AuditLogEntry } from "@/types";

export interface AuditLogEntryWithUser extends AuditLogEntry {
  userName: string | null;
}

export async function getRecentAuditLog(): Promise<AuditLogEntryWithUser[]> {
  await requireCapability("cms.read");
  try {
    const entries = await db
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        details: auditLog.details,
        createdAt: auditLog.createdAt,
        userName: users.name,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(10);

    return entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      details: e.details,
      createdAt: e.createdAt,
      userName: e.userName,
    }));
  } catch {
    return [];
  }
}
