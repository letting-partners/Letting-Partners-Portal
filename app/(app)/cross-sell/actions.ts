"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAgentOrAdmin } from "@/services/permissions";
import {
  CrossSellError,
  requestCollaboration,
  respondToCollaboration,
} from "@/services/cross-sell";

/** Cross-sell request and response actions. */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof CrossSellError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("Cross-sell action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const requestSchema = z.object({
  propertyId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  tenantId: z.string().uuid("Choose one of your tenants."),
  message: z.string().trim().max(1000).optional().nullable(),
});

export async function requestCollaborationAction(
  input: z.input<typeof requestSchema>,
): Promise<ActionResult<{ collaborationId: string }>> {
  try {
    const parsed = requestSchema.parse(input);
    const context = await requireAgentOrAdmin();
    const result = await requestCollaboration(parsed, context);
    revalidatePath("/collaborations");
    revalidatePath("/cross-sell");
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function respondToCollaborationAction(
  collaborationId: string,
  accept: boolean,
  declineReason?: string | null,
): Promise<ActionResult> {
  try {
    const context = await requireAgentOrAdmin();
    await respondToCollaboration(collaborationId, accept, declineReason ?? null, context);
    revalidatePath("/collaborations");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
