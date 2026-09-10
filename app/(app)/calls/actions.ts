"use server";

import { revalidatePath } from "next/cache";
import { deleteCall, CallError } from "@/services/calls";
import { ForbiddenError, requireAdmin } from "@/services/permissions";

/** Call log actions. Only an administrator can change what the log holds. */

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function deleteCallAction(callId: string): Promise<ActionResult> {
  try {
    const context = await requireAdmin();
    await deleteCall(callId, context);

    revalidatePath("/calls");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    if (error instanceof CallError) return { ok: false, error: error.message };
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "Only an administrator can delete a call." };
    }
    console.error("Delete call failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
