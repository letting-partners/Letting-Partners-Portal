import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { notifications, notificationTypeEnum } from "@/db/schema";

/**
 * In-app notifications are the primary signal for daily portal activity.
 * Email is reserved for the few events worth interrupting someone for, which
 * is why nothing here sends mail as a side effect.
 */

export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export async function notify(input: NotifyInput, executor: DbExecutor = db): Promise<void> {
  await executor.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
  });
}

/**
 * Notify several people at once, skipping blanks and duplicates - the same
 * person is often both the property agent and the tenant agent.
 */
export async function notifyMany(
  userIds: (string | null | undefined)[],
  input: Omit<NotifyInput, "userId">,
  executor: DbExecutor = db,
): Promise<void> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return;

  await executor.insert(notifications).values(
    unique.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })),
  );
}

export async function listNotifications(userId: string, limit = 30) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(rows[0]?.value ?? 0);
}

export async function markRead(notificationId: string, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
