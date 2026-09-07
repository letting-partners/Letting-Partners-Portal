"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/services/permissions";
import { lookupPhone, type PhoneLookupResult } from "@/services/phone-lookup";
import {
  CallError,
  markCallInterested,
  recordFollowUp,
  recordNoAnswer,
  recordNotInterested,
  startCall,
} from "@/services/calls";
import { notInterestedReasonEnum, priorityEnum } from "@/db/schema";

/**
 * Server actions behind the call workflow modal.
 *
 * Each one re-derives the access context and re-checks ownership server-side.
 * The browser's earlier lookup is treated as a hint for the UI, never as
 * permission to act.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof CallError) return { ok: false, error: error.message };
  console.error("Call workflow action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/* --------------------------------------------------------------- lookup */

export async function lookupAction(phone: string): Promise<ActionResult<PhoneLookupResult>> {
  try {
    const context = await requireAccess();
    const result = await lookupPhone(phone, context);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/* ----------------------------------------------------------- start call */

const startSchema = z.object({
  phone: z.string().trim().min(1, "Enter a phone number."),
  followUpId: z.string().uuid().nullable().optional(),
  override: z.boolean().optional(),
});

export async function startCallAction(input: {
  phone: string;
  followUpId?: string | null;
  override?: boolean;
}): Promise<ActionResult<{ callId: string; normalizedPhone: string; attemptNumber: number }>> {
  try {
    const parsed = startSchema.parse(input);
    const context = await requireAccess();
    const result = await startCall(parsed.phone, context, {
      followUpId: parsed.followUpId ?? null,
      override: parsed.override ?? false,
    });
    revalidatePath("/calls");
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------- not interested */

const notInterestedSchema = z.object({
  callId: z.string().uuid(),
  reason: z.enum(notInterestedReasonEnum.enumValues),
  notes: z.string().trim().max(2000).optional().nullable(),
  contactName: z.string().trim().max(160).optional().nullable(),
});

export async function notInterestedAction(input: {
  callId: string;
  reason: string;
  notes?: string | null;
  contactName?: string | null;
}): Promise<ActionResult<{ recordId: string }>> {
  try {
    const parsed = notInterestedSchema.parse(input);
    const context = await requireAccess();
    const result = await recordNotInterested(parsed, context);
    revalidatePath("/not-interested");
    revalidatePath("/calls");
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------------- follow up */

const followUpSchema = z.object({
  callId: z.string().uuid(),
  /** Local datetime from the form, e.g. "2026-09-11T14:00". */
  dueAt: z.string().min(1, "Choose a follow-up date."),
  priority: z.enum(priorityEnum.enumValues),
  reason: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().min(1, "Add a note so the next call has context.").max(2000),
  contactName: z.string().trim().max(160).optional().nullable(),
});

export async function followUpAction(input: {
  callId: string;
  dueAt: string;
  priority: string;
  reason?: string | null;
  notes: string;
  contactName?: string | null;
}): Promise<ActionResult<{ followUpId: string }>> {
  try {
    const parsed = followUpSchema.parse(input);
    const context = await requireAccess();

    const dueAt = new Date(parsed.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
      return { ok: false, error: "Choose a valid follow-up date and time." };
    }

    const result = await recordFollowUp(
      {
        callId: parsed.callId,
        dueAt,
        priority: parsed.priority,
        reason: parsed.reason ?? null,
        notes: parsed.notes,
        contactName: parsed.contactName ?? null,
      },
      context,
    );

    revalidatePath("/follow-ups");
    revalidatePath("/calls");
    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Check the follow-up details." };
    }
    return fail(error);
  }
}

/* -------------------------------------------------------------- outcomes */

export async function noAnswerAction(
  callId: string,
  notes?: string | null,
): Promise<ActionResult<null>> {
  try {
    const context = await requireAccess();
    await recordNoAnswer(callId, context, notes ?? null);
    revalidatePath("/calls");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Interested: close the call and hand the caller to the landlord and property
 * onboarding wizard, which is where the records are actually created.
 */
export async function interestedAction(
  callId: string,
): Promise<ActionResult<{ nextHref: string }>> {
  try {
    const context = await requireAccess();
    const { normalizedPhone, originalPhone } = await markCallInterested(callId, context);
    revalidatePath("/calls");

    const params = new URLSearchParams({
      callId,
      phone: normalizedPhone,
      display: originalPhone,
    });

    return { ok: true, data: { nextHref: `/properties/new?${params.toString()}` } };
  } catch (error) {
    return fail(error);
  }
}
