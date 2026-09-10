import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql as raw,
  type SQL,
} from "drizzle-orm";
import { db, type DbExecutor, type Transaction } from "@/db";
import {
  calls,
  followUps,
  landlordOwnershipHistory,
  landlords,
  properties,
  users,
  type genderEnum,
  type contactSourceEnum,
} from "@/db/schema";
import { normalizeUKPhoneDetailed, PHONE_ERROR_MESSAGES } from "@/lib/phone";
import { ENTITY, recordActivity, recordAudit } from "./audit";
import { isUniqueViolation } from "./calls";
import {
  canCorrectLandlordPhone,
  canEditLandlord,
  canViewLandlord,
  ForbiddenError,
  landlordVisibilityFilter,
  withVisibility,
  type AccessContext,
} from "./permissions";

/**
 * Landlord records.
 *
 * The phone number is the landlord's identity in this system, so it is written
 * once at creation and afterwards only an administrator may correct it - and
 * every correction leaves an ownership-history row and an audit entry.
 */

export type Gender = (typeof genderEnum.enumValues)[number];
export type ContactSource = (typeof contactSourceEnum.enumValues)[number];

export class LandlordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LandlordError";
  }
}

export type CreateLandlordInput = {
  name: string;
  email?: string | null;
  phone: string;
  alternatePhone?: string | null;
  gender: Gender;
  /** Landlord by default; an outside agent when they act for an owner. */
  dealerType?: "LANDLORD" | "AGENT";
  source?: ContactSource;
  /** Admins may attribute a manually created landlord to a team. */
  originatingFronterId?: string | null;
  assignedAgentId?: string | null;
};

/** Who a new record belongs to, derived from who is creating it. */
function ownershipFor(
  context: AccessContext,
  overrides: { originatingFronterId?: string | null; assignedAgentId?: string | null } = {},
): { originatingFronterId: string | null; assignedAgentId: string | null } {
  if (context.isAdmin) {
    return {
      originatingFronterId: overrides.originatingFronterId ?? null,
      assignedAgentId: overrides.assignedAgentId ?? null,
    };
  }

  if (context.isAgent) {
    return {
      originatingFronterId: overrides.originatingFronterId ?? null,
      assignedAgentId: context.user.id,
    };
  }

  // A fronter always originates their own records, under their own agent.
  return {
    originatingFronterId: context.user.id,
    assignedAgentId: context.managingAgentId,
  };
}

export async function createLandlord(
  input: CreateLandlordInput,
  context: AccessContext,
  executor?: Transaction,
): Promise<{ id: string; normalizedPhone: string }> {
  const normalization = normalizeUKPhoneDetailed(input.phone);
  if (!normalization.ok) throw new LandlordError(PHONE_ERROR_MESSAGES[normalization.reason]);

  if (!input.name.trim()) throw new LandlordError("Enter the landlord name.");

  const ownership = ownershipFor(context, input);

  const run = async (tx: Transaction) => {
    // Re-check inside the transaction: the browser's lookup may be stale.
    const existing = await tx
      .select({ id: landlords.id, name: landlords.name })
      .from(landlords)
      .where(
        and(
          eq(landlords.normalizedPhone, normalization.normalized),
          isNull(landlords.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0]) {
      throw new LandlordError(
        `That number already belongs to ${existing[0].name}. Open their record instead of creating a duplicate.`,
      );
    }

    const inserted = await tx
      .insert(landlords)
      .values({
        name: input.name.trim(),
        email: input.email?.trim() || null,
        originalPhone: normalization.original,
        normalizedPhone: normalization.normalized,
        alternatePhone: input.alternatePhone?.trim() || null,
        gender: input.gender,
        dealerType: input.dealerType ?? "LANDLORD",
        source: input.source ?? (context.isFronter ? "CALL" : "MANUAL"),
        originatingFronterId: ownership.originatingFronterId,
        assignedAgentId: ownership.assignedAgentId,
        createdBy: context.user.id,
        lastContactAt: new Date(),
      })
      .returning({ id: landlords.id });

    const landlord = inserted[0];

    await tx.insert(landlordOwnershipHistory).values({
      landlordId: landlord.id,
      toFronterId: ownership.originatingFronterId,
      toAgentId: ownership.assignedAgentId,
      toNormalizedPhone: normalization.normalized,
      reason: "Landlord created",
      changedBy: context.user.id,
    });

    // Attach any in-flight calls on this number to the new landlord.
    await tx
      .update(calls)
      .set({ landlordId: landlord.id })
      .where(
        and(eq(calls.normalizedPhone, normalization.normalized), isNull(calls.landlordId)),
      );

    await recordActivity(
      {
        type: "LANDLORD_CREATED",
        entityType: ENTITY.landlord,
        entityId: landlord.id,
        actorId: context.user.id,
        summary: `${context.user.fullName} added landlord ${input.name.trim()}`,
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "CREATE",
        entityType: ENTITY.landlord,
        entityId: landlord.id,
        entityLabel: input.name.trim(),
        after: { name: input.name.trim(), normalizedPhone: normalization.normalized },
      },
      tx,
    );

    return { id: landlord.id, normalizedPhone: normalization.normalized };
  };

  try {
    return executor ? await run(executor) : await db.transaction(run);
  } catch (error) {
    if (isUniqueViolation(error, "landlords_normalized_phone_unique")) {
      throw new LandlordError(
        "Another user created a landlord on this number a moment ago. Look the number up again.",
      );
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ read */

export type LandlordListFilters = {
  search?: string;
  agentId?: string;
  fronterId?: string;
  page?: number;
  pageSize?: number;
  sort?: "recent" | "name" | "lastContact";
};

export const DEFAULT_PAGE_SIZE = 25;

/**
 * Server-side pagination and filtering. Large tables are never shipped whole
 * to the browser.
 */
export async function listLandlords(context: AccessContext, filters: LandlordListFilters = {}) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1), 100);

  const conditions: (SQL | undefined)[] = [isNull(landlords.deletedAt)];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    // A number typed into search is matched on its normalized key, so any
    // format the user types finds the landlord.
    const normalized = normalizeUKPhoneDetailed(filters.search);
    conditions.push(
      or(
        ilike(landlords.name, term),
        ilike(landlords.email, term),
        ilike(landlords.originalPhone, term),
        normalized.ok ? eq(landlords.normalizedPhone, normalized.normalized) : undefined,
      ),
    );
  }

  if (filters.agentId) conditions.push(eq(landlords.assignedAgentId, filters.agentId));
  if (filters.fronterId) conditions.push(eq(landlords.originatingFronterId, filters.fronterId));

  const where = withVisibility(and(...conditions), landlordVisibilityFilter(context));

  const orderBy =
    filters.sort === "name"
      ? asc(landlords.name)
      : filters.sort === "lastContact"
        ? desc(landlords.lastContactAt)
        : desc(landlords.createdAt);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: landlords.id,
        name: landlords.name,
        email: landlords.email,
        alternatePhone: landlords.alternatePhone,
        gender: landlords.gender,
        originalPhone: landlords.originalPhone,
        normalizedPhone: landlords.normalizedPhone,
        createdAt: landlords.createdAt,
        lastContactAt: landlords.lastContactAt,
        originatingFronterId: landlords.originatingFronterId,
        assignedAgentId: landlords.assignedAgentId,
        propertyCount: raw<number>`(
          select count(*)::int from ${properties} p
          where p.landlord_id = ${landlords.id} and p.deleted_at is null
        )`,
      })
      .from(landlords)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db.select({ value: count() }).from(landlords).where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(
    rows.flatMap((row) => [row.originatingFronterId, row.assignedAgentId]),
  );

  return {
    rows: rows.map((row) => ({
      ...row,
      propertyCount: Number(row.propertyCount),
      fronter: row.originatingFronterId ? (people.get(row.originatingFronterId) ?? null) : null,
      agent: row.assignedAgentId ? (people.get(row.assignedAgentId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getLandlord(id: string, context: AccessContext) {
  const rows = await db.select().from(landlords).where(eq(landlords.id, id)).limit(1);
  const landlord = rows[0];
  if (!landlord || landlord.deletedAt) return null;
  if (!canViewLandlord(context, landlord)) throw new ForbiddenError();

  const [people, propertyRows, callRows, followUpRows] = await Promise.all([
    loadPeopleMap([landlord.originatingFronterId, landlord.assignedAgentId, landlord.createdBy]),
    db
      .select({
        id: properties.id,
        reference: properties.reference,
        title: properties.title,
        formattedAddress: properties.formattedAddress,
        postcode: properties.postcode,
        propertyType: properties.propertyType,
        listingStatus: properties.listingStatus,
        dealStage: properties.dealStage,
        rentPerMonthPence: properties.rentPerMonthPence,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .where(and(eq(properties.landlordId, id), isNull(properties.deletedAt)))
      .orderBy(desc(properties.createdAt)),
    db
      .select({
        id: calls.id,
        attemptNumber: calls.attemptNumber,
        startedAt: calls.startedAt,
        outcome: calls.outcome,
        status: calls.status,
        notes: calls.notes,
        calledById: calls.calledById,
      })
      .from(calls)
      .where(eq(calls.normalizedPhone, landlord.normalizedPhone))
      .orderBy(desc(calls.startedAt))
      .limit(20),
    db
      .select()
      .from(followUps)
      .where(eq(followUps.normalizedPhone, landlord.normalizedPhone))
      .orderBy(desc(followUps.dueAt))
      .limit(10),
  ]);

  return {
    landlord,
    fronter: landlord.originatingFronterId
      ? (people.get(landlord.originatingFronterId) ?? null)
      : null,
    agent: landlord.assignedAgentId ? (people.get(landlord.assignedAgentId) ?? null) : null,
    creator: people.get(landlord.createdBy) ?? null,
    properties: propertyRows,
    calls: callRows,
    followUps: followUpRows,
  };
}

/* ----------------------------------------------------------------- write */

export type UpdateLandlordInput = {
  name?: string;
  dealerType?: "LANDLORD" | "AGENT";
  email?: string | null;
  alternatePhone?: string | null;
  gender?: Gender;
};

export async function updateLandlord(
  id: string,
  input: UpdateLandlordInput,
  context: AccessContext,
): Promise<void> {
  const rows = await db.select().from(landlords).where(eq(landlords.id, id)).limit(1);
  const landlord = rows[0];
  if (!landlord || landlord.deletedAt) throw new LandlordError("That landlord no longer exists.");
  if (!canEditLandlord(context, landlord)) throw new ForbiddenError();

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new LandlordError("Enter the landlord name.");
    patch.name = input.name.trim();
  }
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.alternatePhone !== undefined) {
    patch.alternatePhone = input.alternatePhone?.trim() || null;
  }
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.dealerType !== undefined) patch.dealerType = input.dealerType;

  await db.transaction(async (tx) => {
    await tx.update(landlords).set(patch).where(eq(landlords.id, id));

    await recordAudit(
      {
        user: context.user,
        action: "UPDATE",
        entityType: ENTITY.landlord,
        entityId: id,
        entityLabel: landlord.name,
        before: {
          name: landlord.name,
          email: landlord.email,
          alternatePhone: landlord.alternatePhone,
          gender: landlord.gender,
        },
        after: patch,
      },
      tx,
    );

    await recordActivity(
      {
        type: "LANDLORD_UPDATED",
        entityType: ENTITY.landlord,
        entityId: id,
        actorId: context.user.id,
        summary: `${context.user.fullName} updated the landlord details`,
      },
      tx,
    );
  });
}

/**
 * Correct the identity phone number. Admin only, and heavily recorded: the old
 * key, the new key, who changed it and why all survive.
 */
export async function correctLandlordPhone(
  id: string,
  newPhone: string,
  reason: string,
  context: AccessContext,
): Promise<void> {
  if (!canCorrectLandlordPhone(context)) throw new ForbiddenError();
  if (!reason.trim()) throw new LandlordError("Give a reason for the correction.");

  const normalization = normalizeUKPhoneDetailed(newPhone);
  if (!normalization.ok) throw new LandlordError(PHONE_ERROR_MESSAGES[normalization.reason]);

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(landlords).where(eq(landlords.id, id)).limit(1);
    const landlord = rows[0];
    if (!landlord) throw new LandlordError("That landlord no longer exists.");

    if (landlord.normalizedPhone === normalization.normalized) {
      throw new LandlordError("That is already the landlord's number.");
    }

    const clash = await tx
      .select({ id: landlords.id, name: landlords.name })
      .from(landlords)
      .where(
        and(eq(landlords.normalizedPhone, normalization.normalized), isNull(landlords.deletedAt)),
      )
      .limit(1);

    if (clash[0]) {
      throw new LandlordError(`That number already belongs to ${clash[0].name}.`);
    }

    await tx
      .update(landlords)
      .set({
        originalPhone: normalization.original,
        normalizedPhone: normalization.normalized,
        updatedAt: new Date(),
      })
      .where(eq(landlords.id, id));

    await tx.insert(landlordOwnershipHistory).values({
      landlordId: id,
      fromNormalizedPhone: landlord.normalizedPhone,
      toNormalizedPhone: normalization.normalized,
      fromFronterId: landlord.originatingFronterId,
      toFronterId: landlord.originatingFronterId,
      fromAgentId: landlord.assignedAgentId,
      toAgentId: landlord.assignedAgentId,
      reason: reason.trim(),
      changedBy: context.user.id,
    });

    await recordAudit(
      {
        user: context.user,
        action: "PHONE_CORRECTION",
        entityType: ENTITY.landlord,
        entityId: id,
        entityLabel: landlord.name,
        before: { normalizedPhone: landlord.normalizedPhone, originalPhone: landlord.originalPhone },
        after: {
          normalizedPhone: normalization.normalized,
          originalPhone: normalization.original,
        },
        metadata: { reason: reason.trim() },
      },
      tx,
    );
  });
}

/** Reassign a landlord to a different fronter or agent. History is preserved. */
export async function reassignLandlord(
  id: string,
  next: { fronterId?: string | null; agentId?: string | null },
  reason: string,
  context: AccessContext,
): Promise<void> {
  if (!context.isAdmin) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(landlords).where(eq(landlords.id, id)).limit(1);
    const landlord = rows[0];
    if (!landlord) throw new LandlordError("That landlord no longer exists.");

    const toFronter =
      next.fronterId === undefined ? landlord.originatingFronterId : next.fronterId;
    const toAgent = next.agentId === undefined ? landlord.assignedAgentId : next.agentId;

    await tx
      .update(landlords)
      .set({
        originatingFronterId: toFronter,
        assignedAgentId: toAgent,
        updatedAt: new Date(),
      })
      .where(eq(landlords.id, id));

    await tx.insert(landlordOwnershipHistory).values({
      landlordId: id,
      fromFronterId: landlord.originatingFronterId,
      toFronterId: toFronter,
      fromAgentId: landlord.assignedAgentId,
      toAgentId: toAgent,
      reason: reason.trim() || "Ownership changed",
      changedBy: context.user.id,
    });

    await recordAudit(
      {
        user: context.user,
        action: "REASSIGN",
        entityType: ENTITY.landlord,
        entityId: id,
        entityLabel: landlord.name,
        before: {
          originatingFronterId: landlord.originatingFronterId,
          assignedAgentId: landlord.assignedAgentId,
        },
        after: { originatingFronterId: toFronter, assignedAgentId: toAgent },
        metadata: { reason },
      },
      tx,
    );

    await recordActivity(
      {
        type: "OWNERSHIP_CHANGED",
        entityType: ENTITY.landlord,
        entityId: id,
        actorId: context.user.id,
        summary: "Landlord ownership changed",
      },
      tx,
    );
  });
}

/** Soft delete. The record and its history stay for an admin to restore. */
export async function archiveLandlord(id: string, context: AccessContext): Promise<void> {
  const rows = await db.select().from(landlords).where(eq(landlords.id, id)).limit(1);
  const landlord = rows[0];
  if (!landlord) throw new LandlordError("That landlord no longer exists.");
  if (!context.isAdmin && !canEditLandlord(context, landlord)) throw new ForbiddenError();

  const liveProperties = await db
    .select({ value: count() })
    .from(properties)
    .where(and(eq(properties.landlordId, id), isNull(properties.deletedAt)));

  if (Number(liveProperties[0]?.value ?? 0) > 0) {
    throw new LandlordError(
      "Archive or reassign this landlord's properties before archiving the landlord.",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(landlords)
      .set({ deletedAt: new Date(), deletedBy: context.user.id })
      .where(eq(landlords.id, id));

    await recordAudit(
      {
        user: context.user,
        action: "ARCHIVE",
        entityType: ENTITY.landlord,
        entityId: id,
        entityLabel: landlord.name,
      },
      tx,
    );
  });
}

export async function restoreLandlord(id: string, context: AccessContext): Promise<void> {
  if (!context.isAdmin) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    await tx
      .update(landlords)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(landlords.id, id));

    await recordAudit(
      { user: context.user, action: "RESTORE", entityType: ENTITY.landlord, entityId: id },
      tx,
    );
  });
}

/* --------------------------------------------------------------- helpers */

export type PersonRow = {
  id: string;
  fullName: string;
  role: "SUPER_ADMIN" | "AGENT" | "FRONTER";
  avatarUrl: string | null;
};

export async function loadPeopleMap(
  ids: (string | null | undefined)[],
  executor: DbExecutor = db,
): Promise<Map<string, PersonRow>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();

  const rows = await executor
    .select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, unique));

  return new Map(rows.map((row) => [row.id, row]));
}
