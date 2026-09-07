"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, requireAccess } from "@/services/permissions";
import {
  cancelFollowUp,
  completeFollowUp,
  FollowUpError,
  rescheduleFollowUp,
} from "@/services/follow-ups";

/** Follow-up lifecycle actions. */

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof FollowUpError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "This follow-up belongs to another user." };
  }
  console.error("Follow-up action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function refresh() {
  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
}

export async function completeFollowUpAction(
  id: string,
  note?: string | null,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await completeFollowUp(id, note ?? null, context);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function rescheduleFollowUpAction(
  id: string,
  dueAt: string,
  note?: string | null,
): Promise<ActionResult> {
  try {
    const parsed = new Date(dueAt);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Choose a valid date and time." };
    }

    const context = await requireAccess();
    await rescheduleFollowUp(id, parsed, note ?? null, context);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelFollowUpAction(id: string, reason: string): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await cancelFollowUp(id, reason, context);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
