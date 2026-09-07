"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAgentOrAdmin } from "@/services/permissions";
import {
  closeDeal,
  completeVerification,
  completeViewing,
  DealError,
  startViewing,
} from "@/services/deals";
import { DealTransitionError } from "@/services/deal-state";
import { createTenant, TenantError } from "@/services/tenants";

/**
 * Pipeline actions: schedule a viewing, record its outcome, move through
 * verification and closing.
 *
 * Every one of these is a stage transition, so the deal service is the only
 * thing that decides whether the move is legal.
 */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof DealError || error instanceof DealTransitionError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof TenantError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("Pipeline action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function refreshPipeline(propertyId?: string) {
  revalidatePath("/viewings");
  revalidatePath("/verifications");
  revalidatePath("/closings");
  revalidatePath("/dashboard");
  if (propertyId) revalidatePath(`/properties/${propertyId}`);
}

/* ------------------------------------------------------- start a viewing */

const startSchema = z.object({
  propertyId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  tenantId: z.string().uuid().optional(),
  scheduledFor: z.string().min(1, "Choose a date and time for the viewing."),
  notes: z.string().trim().max(2000).optional().nullable(),
  collaborationId: z.string().uuid().nullable().optional(),
  /** Supplied instead of tenantId when registering an applicant inline. */
  newTenant: z
    .object({
      name: z.string().trim().min(1, "Enter the tenant name."),
      phone: z.string().trim().min(1, "Enter a phone number."),
      email: z.string().trim().optional().nullable(),
      area: z.string().trim().optional().nullable(),
      requirements: z.string().trim().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export async function startViewingAction(
  input: z.input<typeof startSchema>,
): Promise<ActionResult<{ dealId: string; viewingId: string }>> {
  try {
    const parsed = startSchema.parse(input);
    const context = await requireAgentOrAdmin();

    const scheduledFor = new Date(parsed.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      return { ok: false, error: "Choose a valid date and time." };
    }

    let tenantId = parsed.tenantId;

    if (!tenantId) {
      if (!parsed.newTenant) {
        return { ok: false, error: "Choose an existing tenant or add a new one." };
      }
      const tenant = await createTenant(
        {
          name: parsed.newTenant.name,
          phone: parsed.newTenant.phone,
          email: parsed.newTenant.email ?? null,
          area: parsed.newTenant.area ?? null,
          requirements: parsed.newTenant.requirements ?? null,
        },
        context,
      );
      tenantId = tenant.id;
    }

    const result = await startViewing({
      propertyId: parsed.propertyId,
      roomId: parsed.roomId ?? null,
      tenantId,
      agentId: context.user.id,
      scheduledFor,
      notes: parsed.notes ?? null,
      collaborationId: parsed.collaborationId ?? null,
      actorId: context.user.id,
    });

    refreshPipeline(parsed.propertyId);
    revalidatePath("/tenants");
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------- viewing outcome */

export async function completeViewingAction(input: {
  viewingId: string;
  successful: boolean;
  reason?: string | null;
  notes?: string | null;
  propertyId?: string;
}): Promise<ActionResult<{ dealId: string }>> {
  try {
    const context = await requireAgentOrAdmin();
    const result = await completeViewing({
      viewingId: input.viewingId,
      successful: input.successful,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      actorId: context.user.id,
    });
    refreshPipeline(input.propertyId);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------- verification outcome */

export async function completeVerificationAction(input: {
  dealId: string;
  successful: boolean;
  reason?: string | null;
  notes?: string | null;
  propertyId?: string;
}): Promise<ActionResult<{ dealId: string }>> {
  try {
    const context = await requireAgentOrAdmin();
    const result = await completeVerification({
      dealId: input.dealId,
      successful: input.successful,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      actorId: context.user.id,
    });
    refreshPipeline(input.propertyId);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------- closing */

export async function closeDealAction(input: {
  dealId: string;
  closed: boolean;
  reason?: string | null;
  notes?: string | null;
  propertyId?: string;
}): Promise<ActionResult<{ closed: boolean; saleId?: string }>> {
  try {
    const context = await requireAgentOrAdmin();
    const result = await closeDeal({
      dealId: input.dealId,
      closed: input.closed,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      actorId: context.user.id,
    });

    refreshPipeline(input.propertyId);
    revalidatePath("/sales");

    return {
      ok: true,
      data: result.closed
        ? { closed: true, saleId: result.saleId }
        : { closed: false },
    };
  } catch (error) {
    return fail(error);
  }
}
