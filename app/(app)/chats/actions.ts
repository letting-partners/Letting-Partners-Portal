"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, requireAccess, requireAgentOrAdmin } from "@/services/permissions";
import {
  assignCustomerConversation,
  ChatError,
  openDirectConversation,
  replyToCustomer,
  sendInternalMessage,
  setCustomerConversationStatus,
  touchPresence,
} from "@/services/chat";

/** Chat actions, split by system so the two can never be confused. */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof ChatError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have access to that conversation." };
  }
  console.error("Chat action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/* ------------------------------------------------------------- customer */

export async function replyToCustomerAction(
  conversationId: string,
  body: string,
  internalNote = false,
): Promise<ActionResult> {
  try {
    const context = await requireAgentOrAdmin();
    await replyToCustomer(conversationId, body, context, { internalNote });
    revalidatePath("/chats/customer");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function assignConversationAction(
  conversationId: string,
  toUserId: string,
): Promise<ActionResult> {
  try {
    const context = await requireAgentOrAdmin();
    await assignCustomerConversation(conversationId, toUserId, context);
    revalidatePath("/chats/customer");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function setConversationStatusAction(
  conversationId: string,
  status: "OPEN" | "WAITING" | "RESOLVED" | "ARCHIVED",
): Promise<ActionResult> {
  try {
    const context = await requireAgentOrAdmin();
    await setCustomerConversationStatus(conversationId, status, context);
    revalidatePath("/chats/customer");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------- internal */

export async function sendInternalMessageAction(
  conversationId: string,
  body: string,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await sendInternalMessage(conversationId, body, context);
    revalidatePath("/chats/internal");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function openDirectConversationAction(
  otherUserId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  try {
    const context = await requireAccess();
    const result = await openDirectConversation(otherUserId, context);
    revalidatePath("/chats/internal");
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/** Called on a timer while the chat screen is open. */
export async function heartbeatAction(): Promise<void> {
  try {
    const context = await requireAccess();
    await touchPresence(context.user.id);
  } catch {
    // Presence is decorative; a failure here must never surface to the user.
  }
}
