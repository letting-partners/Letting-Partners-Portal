import "server-only";
import { and, count, desc, eq, gt, gte, ilike, isNull, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { calls, followUps, landlords, notInterestedRecords, users } from "@/db/schema";
import { normalizeUKPhoneDetailed } from "@/lib/phone";
import { ENTITY, recordActivity, recordAudit } from "./audit";
import { loadPeopleMap } from "./landlords";
import {
  canOverrideFollowUpLock,
  canViewFollowUp,
  followUpVisibilityFilter,
  ForbiddenError,
  withVisibility,
  type AccessContext,
} from "./permissions";

/**
 * Follow-ups, the not-interested register, and the call log.
 *
 * The time-based states (upcoming, due today, overdue) are derived from
 * `dueAt` at read time and never stored, so they cannot go stale.
 */

export class FollowUpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FollowUpError";
  }
}

export type FollowUpFilter = "all" | "due" | "overdue" | "upcoming" | "completed" | "cancelled";

export type FollowUpListOptions = {
  filter?: FollowUpFilter;
  search?: string;
  createdById?: string;
  page?: number;
  pageSize?: number;
};

export async function listFollowUps(context: AccessContext, options: FollowUpListOptions = {}) {
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const conditions: (SQL | undefined)[] = [];

  switch (options.filter) {
    case "due":
      conditions.push(eq(followUps.status, "SCHEDULED"), lte(followUps.dueAt, endOfToday));
      break;
    case "overdue":
      conditions.push(eq(followUps.status, "SCHEDULED"), lte(followUps.dueAt, now));
      break;
    case "upcoming":
      conditions.push(eq(followUps.status, "SCHEDULED"), gt(followUps.dueAt, endOfToday));
      break;
    case "completed":
      conditions.push(or(eq(followUps.status, "COMPLETED"), eq(followUps.status, "CONVERTED")));
      break;
    case "cancelled":
      conditions.push(eq(followUps.status, "CANCELLED"));
      break;
    default:
      break;
  }

  if (options.search) {
    const term = `%${options.search.trim()}%`;
    const normalized = normalizeUKPhoneDetailed(options.search);
    conditions.push(
      or(
        ilike(followUps.contactName, term),
        ilike(followUps.originalPhone, term),
        ilike(followUps.notes, term),
        normalized.ok ? eq(followUps.normalizedPhone, normalized.normalized) : undefined,
      ),
    );
  }

  if (options.createdById) conditions.push(eq(followUps.createdById, options.createdById));

  const where = withVisibility(and(...conditions), followUpVisibilityFilter(context));

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: followUps.id,
        contactName: followUps.contactName,
        originalPhone: followUps.originalPhone,
        normalizedPhone: followUps.normalizedPhone,
        dueAt: followUps.dueAt,
        priority: followUps.priority,
        reason: followUps.reason,
        notes: followUps.notes,
        status: followUps.status,
        createdAt: followUps.createdAt,
        createdById: followUps.createdById,
        agentId: followUps.agentId,
        landlordId: followUps.landlordId,
      })
      .from(followUps)
      .where(where)
      // Soonest first: what needs a call today should be at the top.
      .orderBy(followUps.dueAt)
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db.select({ value: count() }).from(followUps).where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(rows.flatMap((row) => [row.createdById, row.agentId]));

  return {
    rows: rows.map((row) => ({
      ...row,
      createdBy: people.get(row.createdById) ?? null,
      agent: row.agentId ? (people.get(row.agentId) ?? null) : null,
      isOwner: row.createdById === context.user.id,
      canRetry:
        row.createdById === context.user.id ||
        canOverrideFollowUpLock(context, { createdById: row.createdById, agentId: row.agentId }),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/* ------------------------------------------------------------ mutations */

async function loadFollowUp(id: string, context: AccessContext) {
  const rows = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1);
  const followUp = rows[0];
  if (!followUp) throw new FollowUpError("That follow-up no longer exists.");
  if (!canViewFollowUp(context, followUp)) throw new ForbiddenError();
  return followUp;
}

export async function completeFollowUp(
  id: string,
  note: string | null,
  context: AccessContext,
): Promise<void> {
  const followUp = await loadFollowUp(id, context);

  if (followUp.status !== "SCHEDULED") {
    throw new FollowUpError("That follow-up is already closed.");
  }

  const isOwner = followUp.createdById === context.user.id;
  if (!isOwner && !canOverrideFollowUpLock(context, followUp)) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    await tx
      .update(followUps)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        completedById: context.user.id,
        updatedAt: new Date(),
      })
      .where(eq(followUps.id, id));

    await recordActivity(
      {
        type: "FOLLOW_UP_COMPLETED",
        entityType: ENTITY.followUp,
        entityId: id,
        actorId: context.user.id,
        summary: `${context.user.fullName} completed the follow-up`,
        metadata: note ? { note } : undefined,
      },
      tx,
    );

    // Completing frees the number, so record who did it if it was not the owner.
    if (!isOwner) {
      await recordAudit(
        {
          user: context.user,
          action: "OVERRIDE",
          entityType: ENTITY.followUp,
          entityId: id,
          entityLabel: followUp.normalizedPhone,
          metadata: { reason: "Completed another user's follow-up" },
        },
        tx,
      );
    }
  });
}

export async function rescheduleFollowUp(
  id: string,
  dueAt: Date,
  note: string | null,
  context: AccessContext,
): Promise<void> {
  const followUp = await loadFollowUp(id, context);

  if (followUp.status !== "SCHEDULED") {
    throw new FollowUpError("Only a scheduled follow-up can be rescheduled.");
  }
  if (Number.isNaN(dueAt.getTime())) throw new FollowUpError("Choose a valid date and time.");

  const isOwner = followUp.createdById === context.user.id;
  if (!isOwner && !canOverrideFollowUpLock(context, followUp)) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    await tx
      .update(followUps)
      .set({
        dueAt,
        notes: note?.trim() ? `${followUp.notes}\n\n${note.trim()}` : followUp.notes,
        updatedAt: new Date(),
      })
      .where(eq(followUps.id, id));

    await recordActivity(
      {
        type: "FOLLOW_UP_CREATED",
        entityType: ENTITY.followUp,
        entityId: id,
        actorId: context.user.id,
        summary: `${context.user.fullName} rescheduled the follow-up`,
        metadata: { dueAt: dueAt.toISOString() },
      },
      tx,
    );
  });
}

export async function cancelFollowUp(
  id: string,
  reason: string,
  context: AccessContext,
): Promise<void> {
  if (!reason.trim()) throw new FollowUpError("Give a reason for cancelling.");

  const followUp = await loadFollowUp(id, context);
  if (followUp.status !== "SCHEDULED") {
    throw new FollowUpError("That follow-up is already closed.");
  }

  const isOwner = followUp.createdById === context.user.id;
  if (!isOwner && !canOverrideFollowUpLock(context, followUp)) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    await tx
      .update(followUps)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(followUps.id, id));

    await recordAudit(
      {
        user: context.user,
        action: "UPDATE",
        entityType: ENTITY.followUp,
        entityId: id,
        entityLabel: followUp.normalizedPhone,
        metadata: { reason: reason.trim(), cancelled: true },
      },
      tx,
    );
  });
}

/* --------------------------------------------------------- not interested */

export type NotInterestedListOptions = {
  search?: string;
  reason?: string;
  page?: number;
  pageSize?: number;
};

export async function listNotInterested(
  context: AccessContext,
  options: NotInterestedListOptions = {},
) {
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);

  const conditions: (SQL | undefined)[] = [];

  if (options.search) {
    const term = `%${options.search.trim()}%`;
    const normalized = normalizeUKPhoneDetailed(options.search);
    conditions.push(
      or(
        ilike(notInterestedRecords.contactName, term),
        ilike(notInterestedRecords.originalPhone, term),
        ilike(notInterestedRecords.notes, term),
        normalized.ok ? eq(notInterestedRecords.normalizedPhone, normalized.normalized) : undefined,
      ),
    );
  }

  if (options.reason) {
    conditions.push(
      eq(
        notInterestedRecords.reason,
        options.reason as typeof notInterestedRecords.$inferSelect.reason,
      ),
    );
  }

  // Fronters see their own register; agents see their team's; admins see all.
  if (context.isFronter) {
    conditions.push(eq(notInterestedRecords.createdById, context.user.id));
  } else if (context.isAgent) {
    conditions.push(
      or(
        eq(notInterestedRecords.agentId, context.user.id),
        eq(notInterestedRecords.createdById, context.user.id),
      ),
    );
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: notInterestedRecords.id,
        contactName: notInterestedRecords.contactName,
        originalPhone: notInterestedRecords.originalPhone,
        normalizedPhone: notInterestedRecords.normalizedPhone,
        reason: notInterestedRecords.reason,
        notes: notInterestedRecords.notes,
        attemptNumber: notInterestedRecords.attemptNumber,
        createdAt: notInterestedRecords.createdAt,
        createdById: notInterestedRecords.createdById,
        agentId: notInterestedRecords.agentId,
      })
      .from(notInterestedRecords)
      .where(where)
      .orderBy(desc(notInterestedRecords.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db.select({ value: count() }).from(notInterestedRecords).where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(rows.flatMap((row) => [row.createdById, row.agentId]));

  return {
    rows: rows.map((row) => ({
      ...row,
      createdBy: people.get(row.createdById) ?? null,
      agent: row.agentId ? (people.get(row.agentId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/* ---------------------------------------------------------------- calls */

export type CallListOptions = {
  search?: string;
  outcome?: string;
  from?: Date;
  to?: Date;
  calledById?: string;
  page?: number;
  pageSize?: number;
};

export async function listCalls(context: AccessContext, options: CallListOptions = {}) {
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);

  const conditions: (SQL | undefined)[] = [];

  if (context.isFronter) {
    conditions.push(eq(calls.calledById, context.user.id));
  } else if (context.isAgent) {
    conditions.push(or(eq(calls.agentId, context.user.id), eq(calls.calledById, context.user.id)));
  }

  if (options.calledById) conditions.push(eq(calls.calledById, options.calledById));
  if (options.outcome) {
    conditions.push(
      eq(calls.outcome, options.outcome as NonNullable<typeof calls.$inferSelect.outcome>),
    );
  }
  if (options.from) conditions.push(gte(calls.startedAt, options.from));
  if (options.to) conditions.push(lte(calls.startedAt, options.to));

  if (options.search) {
    const term = `%${options.search.trim()}%`;
    const normalized = normalizeUKPhoneDetailed(options.search);
    conditions.push(
      or(
        ilike(calls.originalPhone, term),
        ilike(calls.notes, term),
        ilike(landlords.name, term),
        normalized.ok ? eq(calls.normalizedPhone, normalized.normalized) : undefined,
      ),
    );
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: calls.id,
        originalPhone: calls.originalPhone,
        normalizedPhone: calls.normalizedPhone,
        attemptNumber: calls.attemptNumber,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        status: calls.status,
        outcome: calls.outcome,
        notes: calls.notes,
        adUrl: calls.adUrl,
        openingNote: calls.openingNote,
        calledById: calls.calledById,
        agentId: calls.agentId,
        landlordId: calls.landlordId,
        landlordName: landlords.name,
      })
      .from(calls)
      .leftJoin(landlords, eq(landlords.id, calls.landlordId))
      .where(where)
      .orderBy(desc(calls.startedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ value: count() })
      .from(calls)
      .leftJoin(landlords, eq(landlords.id, calls.landlordId))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(rows.flatMap((row) => [row.calledById, row.agentId]));

  return {
    rows: rows.map((row) => ({
      ...row,
      calledBy: people.get(row.calledById) ?? null,
      agent: row.agentId ? (people.get(row.agentId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Every attempt on a number, for the "view history" action. */
export async function getNumberHistory(normalizedPhone: string) {
  const [callRows, notInterestedRows, followUpRows, landlordRows] = await Promise.all([
    db
      .select({
        id: calls.id,
        attemptNumber: calls.attemptNumber,
        startedAt: calls.startedAt,
        outcome: calls.outcome,
        status: calls.status,
        notes: calls.notes,
        calledById: calls.calledById,
        calledByName: users.fullName,
      })
      .from(calls)
      .leftJoin(users, eq(users.id, calls.calledById))
      .where(eq(calls.normalizedPhone, normalizedPhone))
      .orderBy(desc(calls.startedAt)),

    db
      .select()
      .from(notInterestedRecords)
      .where(eq(notInterestedRecords.normalizedPhone, normalizedPhone))
      .orderBy(desc(notInterestedRecords.createdAt)),

    db
      .select()
      .from(followUps)
      .where(eq(followUps.normalizedPhone, normalizedPhone))
      .orderBy(desc(followUps.dueAt)),

    db
      .select({ id: landlords.id, name: landlords.name })
      .from(landlords)
      .where(and(eq(landlords.normalizedPhone, normalizedPhone), isNull(landlords.deletedAt)))
      .limit(1),
  ]);

  return {
    calls: callRows,
    notInterested: notInterestedRows,
    followUps: followUpRows,
    landlord: landlordRows[0] ?? null,
  };
}
