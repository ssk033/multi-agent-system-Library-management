import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { DomainError } from "@/lib/errors";

export async function listNotifications(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    isRead: row.isRead,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(id: string, userId: string) {
  const db = getDb();
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  if (!updated) throw new DomainError("Notification not found", 404);
  return { id: updated.id, isRead: updated.isRead };
}
