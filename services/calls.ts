import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import {
  activities,
  calls,
  followUps,
  landlords,
  notInterestedRecords,
  properties,
  users,
  type notInterestedReasonEnum,
  type priorityEnum,
} from "@/db/schema";
import { normalizeUKPhoneDetailed, PHONE_ERROR_MESSAGES } from "@/lib/phone";
import { ENTITY, recordActivity, recordAudit } from "./audit";
import { lookupPhone } from "./phone-lookup";
import { ForbiddenError, type AccessContext } from "./permissions";

/**
 * Call lifecycle writes. A retry never rewrites an earlier attempt: it adds a
 * new one linked to everything that came before, so the contact history for a
 * number reads in order.
 *
 * The one exception is `deleteCall`, an administrator removing an attempt that
 * should not be in the log at all - a mis-dial, a test, a number typed wrong.
 */

export type NotInterestedReason = (typeof notInterestedReasonEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];

export class CallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallError";
  }
}

/** The agent a user's work rolls up to: themselves, or the agent they report to. */
function agentFor(context: AccessContext): string | null {
  if (context.isAgent) return context.user.id;
  if (context.isFronter) return context.managingAgentId;
  return null;
}

/**
 * Open a call.
 *
 * Ownership is re-checked here, inside the transaction, rather than trusting
 * the lookup the browser did moments ago - two fronters can look up the same
 * unknown number at the same time, and only one of them may claim it.
 */
export async function startCall(
  rawPhone: string,
  context: AccessContext,
  options: {
    followUpId?: string | null;
    override?: boolean;
    adUrl?: string | null;
    openingNote?: string | null;
  } = {},
): Promise<{ callId: string; normalizedPhone: string; attemptNumber: number }> {
  const normalization = normalizeUKPhoneDetailed(rawPhone);
  if (!normalization.ok) throw new CallError(PHONE_ERROR_MESSAGES[normalization.reason]);

  const { normalized, original } = normalization;

  return db.transaction(async (tx: Transaction) => {
    const lookup = await lookupPhone(normalized, context, tx);

    if (lookup.kind === "FOLLOW_UP_LOCKED" && !lookup.isOwner) {
      const owner = lookup.owner?.fullName ?? "another user";

      // `requiresOverride` was already decided by the permission service
      // against the real follow-up row, so it is the only check needed here.
      if (!lookup.requiresOverride) {
        throw new CallError(
          `This number is locked to an active follow-up owned by ${owner}.`,
        );
      }

      if (!options.override) {
        throw new CallError(
          `This number is locked to ${owner}. Confirm the override to take the call.`,
        );
      }

      await recordAudit(
        {
          user: context.user,
          action: "OVERRIDE",
          entityType: ENTITY.followUp,
          entityId: lookup.followUp.id,
          entityLabel: normalized,
          metadata: {
            reason: "Follow-up lock overridden to start a call",
            ownerId: lookup.owner?.id ?? null,
            dueAt: lookup.followUp.dueAt.toISOString(),
          },
        },
        tx,
      );
    }

    const [attemptRow] = await tx
      .select({ value: count() })
      .from(calls)
      .where(eq(calls.normalizedPhone, normalized));

    const attemptNumber = Number(attemptRow?.value ?? 0) + 1;

    const landlordRows = await tx
      .select({ id: landlords.id })
      .from(landlords)
      .where(and(eq(landlords.normalizedPhone, normalized), isNull(landlords.deletedAt)))
      .limit(1);

    const inserted = await tx
      .insert(calls)
      .values({
        originalPhone: original,
        normalizedPhone: normalized,
        attemptNumber,
        landlordId: landlordRows[0]?.id ?? null,
        calledById: context.user.id,
        agentId: agentFor(context),
        status: "IN_PROGRESS",
        followUpId: options.followUpId ?? null,
        adUrl: options.adUrl?.trim() || null,
        openingNote: options.openingNote?.trim() || null,
      })
      .returning({ id: calls.id });

    const call = inserted[0];

    await recordActivity(
      {
        type: "CALL_LOGGED",
        entityType: ENTITY.call,
        entityId: call.id,
        actorId: context.user.id,
        summary: `Call started to ${normalized} (attempt ${attemptNumber})`,
      },
      tx,
    );

    return { callId: call.id, normalizedPhone: normalized, attemptNumber };
  });
}

function closeCallPatch(outcome: (typeof calls.$inferSelect)["outcome"], startedAt: Date) {
  const endedAt = new Date();
  return {
    status: "COMPLETED" as const,
    outcome,
    endedAt,
    durationSeconds: Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)),
  };
}

async function loadOwnCall(tx: Transaction, callId: string, context: AccessContext) {
  const rows = await tx.select().from(calls).where(eq(calls.id, callId)).limit(1);
  const call = rows[0];
  if (!call) throw new CallError("That call no longer exists.");
  if (call.calledById !== context.user.id && !context.isAdmin && !context.isAgent) {
    throw new CallError("You can only record the outcome of your own calls.");
  }
  if (call.status !== "IN_PROGRESS") {
    throw new CallError("That call already has an outcome recorded.");
  }
  return call;
}

/** Record "not interested". The record is additive - history is never removed. */
export async function recordNotInterested(
  input: {
    callId: string;
    reason: NotInterestedReason;
    notes?: string | null;
    contactName?: string | null;
  },
  context: AccessContext,
): Promise<{ recordId: string }> {
  return db.transaction(async (tx: Transaction) => {
    const call = await loadOwnCall(tx, input.callId, context);

    await tx
      .update(calls)
      .set({ ...closeCallPatch("NOT_INTERESTED", call.startedAt), notes: input.notes ?? null })
      .where(eq(calls.id, call.id));

    const [attemptRow] = await tx
      .select({ value: count() })
      .from(notInterestedRecords)
      .where(eq(notInterestedRecords.normalizedPhone, call.normalizedPhone));

    const inserted = await tx
      .insert(notInterestedRecords)
      .values({
        callId: call.id,
        originalPhone: call.originalPhone,
        normalizedPhone: call.normalizedPhone,
        contactName: input.contactName ?? null,
        reason: input.reason,
        notes: input.notes ?? null,
        attemptNumber: Number(attemptRow?.value ?? 0) + 1,
        createdById: context.user.id,
        agentId: agentFor(context),
      })
      .returning({ id: notInterestedRecords.id });

    await recordActivity(
      {
        type: "NOT_INTERESTED_LOGGED",
        entityType: ENTITY.call,
        entityId: call.id,
        actorId: context.user.id,
        summary: `Marked not interested (${input.reason.replace(/_/g, " ").toLowerCase()})`,
      },
      tx,
    );

    return { recordId: inserted[0].id };
  });
}

/**
 * Schedule a follow-up. The partial unique index on the phone key is what
 * actually enforces the lock, so a race between two fronters ends with one
 * insert succeeding and the other getting a clear error rather than a
 * duplicate claim.
 */
export async function recordFollowUp(
  input: {
    callId: string;
    dueAt: Date;
    priority: Priority;
    reason?: string | null;
    notes: string;
    contactName?: string | null;
  },
  context: AccessContext,
): Promise<{ followUpId: string }> {
  if (!input.notes.trim()) throw new CallError("Add a note so the next call has context.");
  if (Number.isNaN(input.dueAt.getTime())) throw new CallError("Choose a valid follow-up date.");

  try {
    return await db.transaction(async (tx: Transaction) => {
      const call = await loadOwnCall(tx, input.callId, context);

      await tx
        .update(calls)
        .set({ ...closeCallPatch("FOLLOW_UP", call.startedAt), notes: input.notes })
        .where(eq(calls.id, call.id));

      const inserted = await tx
        .insert(followUps)
        .values({
          callId: call.id,
          originalPhone: call.originalPhone,
          normalizedPhone: call.normalizedPhone,
          contactName: input.contactName ?? null,
          dueAt: input.dueAt,
          priority: input.priority,
          reason: input.reason ?? null,
          notes: input.notes,
          createdById: context.user.id,
          agentId: agentFor(context),
        })
        .returning({ id: followUps.id });

      await tx.update(calls).set({ followUpId: inserted[0].id }).where(eq(calls.id, call.id));

      await recordActivity(
        {
          type: "FOLLOW_UP_CREATED",
          entityType: ENTITY.followUp,
          entityId: inserted[0].id,
          actorId: context.user.id,
          summary: `Follow-up scheduled for ${input.dueAt.toISOString().slice(0, 10)}`,
        },
        tx,
      );

      return { followUpId: inserted[0].id };
    });
  } catch (error) {
    if (isUniqueViolation(error, "follow_ups_active_phone_unique")) {
      throw new CallError(
        "Another user scheduled a follow-up on this number a moment ago. Look the number up again.",
      );
    }
    throw error;
  }
}

/** Close a call with no answer, so the attempt is still on record. */
export async function recordNoAnswer(
  callId: string,
  context: AccessContext,
  notes?: string | null,
): Promise<void> {
  await db.transaction(async (tx: Transaction) => {
    const call = await loadOwnCall(tx, callId, context);
    await tx
      .update(calls)
      .set({ ...closeCallPatch("NO_ANSWER", call.startedAt), notes: notes ?? null })
      .where(eq(calls.id, call.id));
  });
}

export async function cancelCall(callId: string, context: AccessContext): Promise<void> {
  await db.transaction(async (tx: Transaction) => {
    const call = await loadOwnCall(tx, callId, context);
    await tx
      .update(calls)
      .set({ status: "CANCELLED", outcome: "CANCELLED", endedAt: new Date() })
      .where(eq(calls.id, call.id));
  });
}

/**
 * Remove a call attempt from the log. Administrators only.
 *
 * Deleting is refused once the call has produced a property: that record is
 * real business history, and the call is where it came from. Anything else the
 * call left behind - a follow-up, a not-interested record - survives with its
 * link to the call cleared, because those are separate decisions with their
 * own history and cancelling them is a different act.
 *
 * The deletion itself is audited with the number and outcome, so removing a
 * call from the log does not remove the fact that somebody removed it. It is
 * filed under ARCHIVE, the audit trail's word for a record taken out of use.
 */
export async function deleteCall(callId: string, context: AccessContext): Promise<void> {
  if (!context.isAdmin) throw new ForbiddenError();

  await db.transaction(async (tx: Transaction) => {
    const rows = await tx.select().from(calls).where(eq(calls.id, callId)).limit(1);
    const call = rows[0];
    if (!call) throw new CallError("That call is no longer in the log.");

    const [produced] = await tx
      .select({ id: properties.id, reference: properties.reference })
      .from(properties)
      .where(and(eq(properties.originatingCallId, callId), isNull(properties.deletedAt)))
      .limit(1);

    if (produced) {
      throw new CallError(
        `This call created ${produced.reference}, so it is part of that property's history. Archive the property instead.`,
      );
    }

    await tx.update(followUps).set({ callId: null }).where(eq(followUps.callId, callId));
    await tx
      .update(notInterestedRecords)
      .set({ callId: null })
      .where(eq(notInterestedRecords.callId, callId));

    await tx
      .delete(activities)
      .where(and(eq(activities.entityType, ENTITY.call), eq(activities.entityId, callId)));

    await tx.delete(calls).where(eq(calls.id, callId));

    await recordAudit(
      {
        user: context.user,
        action: "ARCHIVE",
        entityType: ENTITY.call,
        entityId: callId,
        entityLabel: `${call.originalPhone} attempt ${call.attemptNumber}`,
        before: {
          normalizedPhone: call.normalizedPhone,
          outcome: call.outcome,
          startedAt: call.startedAt,
          calledById: call.calledById,
        },
      },
      tx,
    );
  });
}

/**
 * Mark the call interested. The landlord and property are created by the
 * onboarding wizard that follows; this only closes the call so the outcome is
 * recorded even if the user abandons the wizard.
 */
export async function markCallInterested(
  callId: string,
  context: AccessContext,
): Promise<{ normalizedPhone: string; originalPhone: string }> {
  return db.transaction(async (tx: Transaction) => {
    const call = await loadOwnCall(tx, callId, context);

    await tx
      .update(calls)
      .set(closeCallPatch("INTERESTED", call.startedAt))
      .where(eq(calls.id, call.id));

    // Continuing an existing follow-up converts it rather than leaving it open.
    if (call.followUpId) {
      await tx
        .update(followUps)
        .set({
          status: "CONVERTED",
          completedAt: new Date(),
          completedById: context.user.id,
          updatedAt: new Date(),
        })
        .where(eq(followUps.id, call.followUpId));
    }

    return { normalizedPhone: call.normalizedPhone, originalPhone: call.originalPhone };
  });
}

/** Full contact history for a number, newest first. */
export async function getCallHistory(normalizedPhone: string, limit = 50) {
  return db
    .select({
      id: calls.id,
      attemptNumber: calls.attemptNumber,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      durationSeconds: calls.durationSeconds,
      status: calls.status,
      outcome: calls.outcome,
      notes: calls.notes,
      calledById: calls.calledById,
      calledByName: users.fullName,
    })
    .from(calls)
    .leftJoin(users, eq(users.id, calls.calledById))
    .where(eq(calls.normalizedPhone, normalizedPhone))
    .orderBy(desc(calls.startedAt))
    .limit(limit);
}

/** Postgres unique-violation detection without leaking driver details upward. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; constraint_name?: string; message?: string };
  if (candidate.code !== "23505") return false;
  if (!constraint) return true;
  return (
    candidate.constraint_name === constraint ||
    Boolean(candidate.message && candidate.message.includes(constraint))
  );
}
