import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql as raw, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  collaborationParticipants,
  collaborations,
  properties,
  propertyRooms,
  tenants,
  users,
} from "@/db/schema";
import { getOutcode, parseOutcodeList } from "@/lib/postcode";
import { ENTITY, recordActivity, recordAudit } from "./audit";
import { loadPeopleMap } from "./landlords";
import { notifyMany } from "./notifications";
import { getCrossSellSplit } from "./settings";
import { isUniqueViolation } from "./calls";
import {
  canAccessCrossSell,
  canViewTenant,
  ForbiddenError,
  type AccessContext,
} from "./permissions";

/**
 * Cross-sell: one agent has a tenant, another has a property.
 *
 * The search deliberately returns a *reduced* view of someone else's property.
 * Landlord identity, contact details, commission and internal notes are never
 * part of the result - an agent gets what they need to judge a match and
 * nothing more.
 */

export class CrossSellError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrossSellError";
  }
}

export type CrossSellFilters = {
  area?: string;
  outcode?: string;
  propertyType?: "FULL" | "SHARED";
  minRentPence?: number;
  maxRentPence?: number;
  bedrooms?: number;
  /** Widen an outcode search to the whole postcode area, e.g. M14 -> M. */
  wholeArea?: boolean;
  page?: number;
  pageSize?: number;
};

export type CrossSellResult = {
  id: string;
  reference: string;
  title: string | null;
  area: string | null;
  outcode: string;
  propertyType: "FULL" | "SHARED";
  category: string | null;
  rentPerMonthPence: number | null;
  fromRentPence: number | null;
  availableRooms: number;
  totalRooms: number;
  availabilityDate: string | null;
  listingStatus: string;
  propertyAgentId: string | null;
  propertyAgentName: string | null;
  propertyAgentAvatar: string | null;
  /** True when the property already belongs to the searching agent. */
  isMine: boolean;
};

/**
 * Find properties across the whole business that a tenant could be placed in.
 * Only live, available listings from *other* agents are useful here.
 */
export async function searchCrossSell(
  context: AccessContext,
  filters: CrossSellFilters = {},
): Promise<{ rows: CrossSellResult[]; total: number; page: number; pageCount: number; pageSize: number }> {
  if (!canAccessCrossSell(context)) throw new ForbiddenError();

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 24, 1), 60);

  const conditions: (SQL | undefined)[] = [
    isNull(properties.deletedAt),
    // Only properties genuinely open to a new tenant.
    eq(properties.dealStage, "AVAILABLE"),
    raw`${properties.listingStatus} in ('PUBLISHED','READY_TO_PUBLISH','UNPUBLISHED')`,
  ];

  if (filters.outcode) {
    const outcode = filters.outcode.trim().toUpperCase();
    if (filters.wholeArea) {
      const areaLetters = /^[A-Z]{1,2}/.exec(outcode)?.[0];
      if (areaLetters) conditions.push(ilike(properties.outcode, `${areaLetters}%`));
    } else {
      conditions.push(eq(properties.outcode, outcode));
    }
  }

  if (filters.area) conditions.push(ilike(properties.area, `%${filters.area.trim()}%`));
  if (filters.propertyType) conditions.push(eq(properties.propertyType, filters.propertyType));
  if (filters.bedrooms) conditions.push(gte(properties.numberOfRooms, filters.bedrooms));

  // Rent filtering has to consider room rents on a shared property.
  if (filters.minRentPence) {
    conditions.push(
      or(
        gte(properties.rentPerMonthPence, filters.minRentPence),
        raw`exists (
          select 1 from ${propertyRooms} r
          where r.property_id = ${properties.id} and r.deleted_at is null
            and r.status = 'AVAILABLE' and r.rent_per_month_pence >= ${filters.minRentPence}
        )`,
      ),
    );
  }

  if (filters.maxRentPence) {
    conditions.push(
      or(
        lte(properties.rentPerMonthPence, filters.maxRentPence),
        raw`exists (
          select 1 from ${propertyRooms} r
          where r.property_id = ${properties.id} and r.deleted_at is null
            and r.status = 'AVAILABLE' and r.rent_per_month_pence <= ${filters.maxRentPence}
        )`,
      ),
    );
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: properties.id,
        reference: properties.reference,
        title: properties.title,
        area: properties.area,
        outcode: properties.outcode,
        propertyType: properties.propertyType,
        category: properties.category,
        rentPerMonthPence: properties.rentPerMonthPence,
        availabilityDate: properties.availabilityDate,
        listingStatus: properties.listingStatus,
        assignedAgentId: properties.assignedAgentId,
        agentName: users.fullName,
        agentAvatar: users.avatarUrl,
        totalRooms: raw<number>`(
          select count(*)::int from ${propertyRooms} r
          where r.property_id = ${properties.id} and r.deleted_at is null
        )`,
        availableRooms: raw<number>`(
          select count(*)::int from ${propertyRooms} r
          where r.property_id = ${properties.id} and r.deleted_at is null and r.status = 'AVAILABLE'
        )`,
        fromRentPence: raw<number | null>`(
          select min(r.rent_per_month_pence)::int from ${propertyRooms} r
          where r.property_id = ${properties.id} and r.deleted_at is null and r.status = 'AVAILABLE'
        )`,
      })
      .from(properties)
      .leftJoin(users, eq(users.id, properties.assignedAgentId))
      .where(where)
      .orderBy(desc(properties.publishedAt), desc(properties.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db.select({ value: count() }).from(properties).where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      title: row.title,
      area: row.area,
      outcode: row.outcode,
      propertyType: row.propertyType,
      category: row.category,
      rentPerMonthPence: row.rentPerMonthPence,
      fromRentPence: row.fromRentPence === null ? null : Number(row.fromRentPence),
      availableRooms: Number(row.availableRooms),
      totalRooms: Number(row.totalRooms),
      availabilityDate: row.availabilityDate,
      listingStatus: row.listingStatus,
      propertyAgentId: row.assignedAgentId,
      propertyAgentName: row.agentName,
      propertyAgentAvatar: row.agentAvatar,
      isMine: row.assignedAgentId === context.user.id,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Suggested search values taken from a tenant's own requirements. */
export async function suggestedFiltersForTenant(
  tenantId: string,
  context: AccessContext,
): Promise<CrossSellFilters> {
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const tenant = rows[0];
  if (!tenant || !canViewTenant(context, tenant)) return {};

  const outcodes = parseOutcodeList(tenant.postcodePreferences);

  // The tenant's type preference is a category (house/flat/studio), which is a
  // different axis from full versus shared, so it is not mapped here.
  return {
    outcode: outcodes[0] ?? getOutcode(tenant.area) ?? undefined,
    area: outcodes.length === 0 ? (tenant.area ?? undefined) : undefined,
    minRentPence: tenant.minBudgetPence ?? undefined,
    maxRentPence: tenant.maxBudgetPence ?? undefined,
    bedrooms: tenant.bedrooms ?? undefined,
  };
}

/* --------------------------------------------------------- collaboration */

export async function requestCollaboration(
  input: { propertyId: string; roomId?: string | null; tenantId: string; message?: string | null },
  context: AccessContext,
): Promise<{ collaborationId: string }> {
  if (!canAccessCrossSell(context)) throw new ForbiddenError();

  try {
    return await db.transaction(async (tx) => {
      const propertyRows = await tx
        .select({
          id: properties.id,
          reference: properties.reference,
          formattedAddress: properties.formattedAddress,
          assignedAgentId: properties.assignedAgentId,
          propertyType: properties.propertyType,
          dealStage: properties.dealStage,
        })
        .from(properties)
        .where(and(eq(properties.id, input.propertyId), isNull(properties.deletedAt)))
        .limit(1);

      const property = propertyRows[0];
      if (!property) throw new CrossSellError("That property no longer exists.");
      if (!property.assignedAgentId) {
        throw new CrossSellError("That property has no agent to send the request to.");
      }
      if (property.assignedAgentId === context.user.id) {
        throw new CrossSellError("This is already your property - start a viewing directly.");
      }
      if (property.dealStage !== "AVAILABLE") {
        throw new CrossSellError("That property already has a deal in progress.");
      }
      if (property.propertyType === "SHARED" && !input.roomId) {
        throw new CrossSellError("Choose which room the request is for.");
      }

      const tenantRows = await tx.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
      const tenant = tenantRows[0];
      if (!tenant || tenant.deletedAt) throw new CrossSellError("That tenant no longer exists.");
      if (!canViewTenant(context, tenant)) throw new ForbiddenError();

      const inserted = await tx
        .insert(collaborations)
        .values({
          propertyId: property.id,
          roomId: input.roomId ?? null,
          tenantId: tenant.id,
          tenantAgentId: context.user.id,
          propertyAgentId: property.assignedAgentId,
          status: "PENDING",
          message: input.message?.trim() || null,
          createdBy: context.user.id,
        })
        .returning({ id: collaborations.id });

      const collaboration = inserted[0];

      await tx.insert(collaborationParticipants).values([
        { collaborationId: collaboration.id, userId: context.user.id, role: "TENANT_AGENT" },
        {
          collaborationId: collaboration.id,
          userId: property.assignedAgentId,
          role: "PROPERTY_AGENT",
        },
      ]);

      await recordActivity(
        {
          type: "COLLABORATION_REQUESTED",
          entityType: ENTITY.collaboration,
          entityId: collaboration.id,
          relatedEntityType: ENTITY.property,
          relatedEntityId: property.id,
          actorId: context.user.id,
          summary: `${context.user.fullName} requested a cross-sell on ${property.reference}`,
        },
        tx,
      );

      await notifyMany(
        [property.assignedAgentId],
        {
          type: "CROSS_SELL_REQUEST",
          title: "New cross-sell request",
          body: `${context.user.fullName} has a tenant for ${property.formattedAddress}.`,
          href: "/collaborations",
          entityType: ENTITY.collaboration,
          entityId: collaboration.id,
        },
        tx,
      );

      return { collaborationId: collaboration.id };
    });
  } catch (error) {
    if (isUniqueViolation(error, "collaborations_open_request_unique")) {
      throw new CrossSellError(
        "There is already an open request for this tenant and property.",
      );
    }
    throw error;
  }
}

export async function respondToCollaboration(
  collaborationId: string,
  accept: boolean,
  declineReason: string | null,
  context: AccessContext,
): Promise<void> {
  if (!accept && !declineReason?.trim()) {
    throw new CrossSellError("Give a reason for declining.");
  }

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(collaborations)
      .where(eq(collaborations.id, collaborationId))
      .limit(1);

    const collaboration = rows[0];
    if (!collaboration) throw new CrossSellError("That request no longer exists.");
    if (collaboration.status !== "PENDING") {
      throw new CrossSellError("That request has already been answered.");
    }

    // Only the property agent, or an admin, may answer.
    if (collaboration.propertyAgentId !== context.user.id && !context.isAdmin) {
      throw new ForbiddenError();
    }

    // The split is frozen here so a later settings change cannot alter an
    // agreement the two agents already made.
    const split = accept ? await getCrossSellSplit(tx) : null;

    await tx
      .update(collaborations)
      .set({
        status: accept ? "ACCEPTED" : "DECLINED",
        declineReason: accept ? null : declineReason!.trim(),
        propertyAgentSplitBp: split?.propertyAgentBp ?? null,
        tenantAgentSplitBp: split?.tenantAgentBp ?? null,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(collaborations.id, collaborationId));

    await recordActivity(
      {
        type: "COLLABORATION_ANSWERED",
        entityType: ENTITY.collaboration,
        entityId: collaborationId,
        actorId: context.user.id,
        summary: accept
          ? `${context.user.fullName} accepted the cross-sell request`
          : `${context.user.fullName} declined the cross-sell request`,
        metadata: accept ? { split } : { reason: declineReason },
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "UPDATE",
        entityType: ENTITY.collaboration,
        entityId: collaborationId,
        after: { status: accept ? "ACCEPTED" : "DECLINED", split },
      },
      tx,
    );

    await notifyMany(
      [collaboration.tenantAgentId],
      {
        type: accept ? "CROSS_SELL_ACCEPTED" : "CROSS_SELL_DECLINED",
        title: accept ? "Cross-sell accepted" : "Cross-sell declined",
        body: accept
          ? "You can now book a viewing on the property."
          : (declineReason ?? "The property agent declined."),
        href: "/collaborations",
        entityType: ENTITY.collaboration,
        entityId: collaborationId,
      },
      tx,
    );
  });
}

export type CollaborationListFilters = {
  status?: string;
  page?: number;
  pageSize?: number;
};

export async function listCollaborations(
  context: AccessContext,
  filters: CollaborationListFilters = {},
) {
  if (!canAccessCrossSell(context)) throw new ForbiddenError();

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);

  const conditions: (SQL | undefined)[] = [];

  if (!context.isAdmin) {
    conditions.push(
      or(
        eq(collaborations.tenantAgentId, context.user.id),
        eq(collaborations.propertyAgentId, context.user.id),
      ),
    );
  }

  if (filters.status) {
    conditions.push(
      eq(collaborations.status, filters.status as typeof collaborations.$inferSelect.status),
    );
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: collaborations.id,
        status: collaborations.status,
        message: collaborations.message,
        declineReason: collaborations.declineReason,
        propertyAgentSplitBp: collaborations.propertyAgentSplitBp,
        tenantAgentSplitBp: collaborations.tenantAgentSplitBp,
        requestedAt: collaborations.requestedAt,
        respondedAt: collaborations.respondedAt,
        dealId: collaborations.dealId,
        propertyId: collaborations.propertyId,
        propertyReference: properties.reference,
        propertyAddress: properties.formattedAddress,
        propertyTitle: properties.title,
        roomName: propertyRooms.name,
        roomId: collaborations.roomId,
        tenantId: collaborations.tenantId,
        tenantName: tenants.name,
        tenantAgentId: collaborations.tenantAgentId,
        propertyAgentId: collaborations.propertyAgentId,
      })
      .from(collaborations)
      .innerJoin(properties, eq(properties.id, collaborations.propertyId))
      .innerJoin(tenants, eq(tenants.id, collaborations.tenantId))
      .leftJoin(propertyRooms, eq(propertyRooms.id, collaborations.roomId))
      .where(where)
      .orderBy(desc(collaborations.requestedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ value: count() })
      .from(collaborations)
      .innerJoin(properties, eq(properties.id, collaborations.propertyId))
      .innerJoin(tenants, eq(tenants.id, collaborations.tenantId))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(
    rows.flatMap((row) => [row.tenantAgentId, row.propertyAgentId]),
  );

  return {
    rows: rows.map((row) => ({
      ...row,
      tenantAgent: people.get(row.tenantAgentId) ?? null,
      propertyAgent: people.get(row.propertyAgentId) ?? null,
      /** This user owns the property side, so they answer the request. */
      canRespond:
        row.status === "PENDING" &&
        (row.propertyAgentId === context.user.id || context.isAdmin),
      /** This user brought the tenant, so they book the viewing once accepted. */
      canStartViewing: row.status === "ACCEPTED" && row.tenantAgentId === context.user.id,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Agents other than this one, for admin filters. */
export async function listOtherAgents(context: AccessContext) {
  return db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(
      and(
        inArray(users.role, ["AGENT", "SUPER_ADMIN"]),
        ne(users.id, context.user.id),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(users.fullName);
}
