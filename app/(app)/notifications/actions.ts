"use server";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/services/permissions";
import { markAllRead, markRead } from "@/services/notifications";

/** Notification read state. */

export async function markAllReadAction(): Promise<void> {
  const context = await requireAccess();
  await markAllRead(context.user.id);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markReadAction(notificationId: string): Promise<void> {
  const context = await requireAccess();
  await markRead(notificationId, context.user.id);
  revalidatePath("/notifications");
}
