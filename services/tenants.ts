import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import {
  deals,
  properties,
  propertyRooms,
  tenants,
  users,
  type tenantStatusEnum,
} from "@/db/schema";
import { normalizeUKPhoneDetailed, PHONE_ERROR_MESSAGES } from "@/lib/phone";
import { ENTITY, recordActivity, recordAudit } from "./audit";
import { loadPeopleMap } from "./landlords";
import { notifyMany } from "./notifications";
import {
  canEditTenant,
  canViewTenant,
  ForbiddenError,
  tenantVisibilityFilter,
  withVisibility,
  type AccessContext,
} from "./permissions";

/**
 * Applicants. Owned by the agent who registered them - that ownership is what
 * makes one side of a cross-sell unambiguous.
 */

export type TenantStatus = (typeof tenantStatusEnum.enumValues)[number];

export class TenantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantError";
  }
}

export type CreateTenantInput = {
  name: string;
  email?: string | null;
  phone: string;
  area?: string | null;
  postcodePreferences?: string | null;
  requirements?: string | null;
  minBudgetPence?: number | null;
  maxBudgetPence?: number | null;
  moveInDate?: string | null;
  propertyTypePreference?: "HOUSE" | "FLAT" | "STUDIO_FLAT" | null;
  bedrooms?: number | null;
  /** Admins may register a tenant on behalf of an agent. */
  ownerAgentId?: string | null;

  /* Asked in the portal only - see the schema for why. */
  roomType?: string | null;
  occupants?: string | null;
  monthlyIncomePence?: number | null;
  occupation?: string | null;
  countryOfOrigin?: string | null;
};

export async function createTenant(
  input: CreateTenantInput,
  context: AccessContext,
  executor?: Transaction,
): Promise<{ id: string }> {
  if (!input.name.trim()) throw new TenantError("Enter the tenant name.");

  const normalization = normalizeUKPhoneDetailed(input.phone);
  if (!normalization.ok) throw new TenantError(PHONE_ERROR_MESSAGES[normalization.reason]);

  if (
    input.minBudgetPence != null &&
    input.maxBudgetPence != null &&
    input.minBudgetPence > input.maxBudgetPence
  ) {
    throw new TenantError("The minimum budget cannot be more than the maximum.");
  }

  // Fronters do not run the letting side, so they cannot own applicants.
  if (context.isFronter) throw new ForbiddenError();

  const ownerAgentId = context.isAdmin
    ? (input.ownerAgentId ?? context.user.id)
    : context.user.id;

  const run = async (tx: Transaction) => {
    const inserted = await tx
      .insert(tenants)
      .values({
        name: input.name.trim(),
        email: input.email?.trim() || null,
        originalPhone: normalization.original,
        normalizedPhone: normalization.normalized,
        area: input.area?.trim() || null,
        postcodePreferences: input.postcodePreferences?.trim().toUpperCase() || null,
        requirements: input.requirements?.trim() || null,
        minBudgetPence: input.minBudgetPence ?? null,
        maxBudgetPence: input.maxBudgetPence ?? null,
        moveInDate: input.moveInDate || null,
        propertyTypePreference: input.propertyTypePreference ?? null,
        bedrooms: input.bedrooms ?? null,
        roomType: input.roomType?.trim() || null,
        occupants: input.occupants?.trim() || null,
        monthlyIncomePence: input.monthlyIncomePence ?? null,
        occupation: input.occupation?.trim() || null,
        countryOfOrigin: input.countryOfOrigin?.trim() || null,
        status: "ACTIVE",
        ownerAgentId,
        createdBy: context.user.id,
        source: "MANUAL",
      })
      .returning({ id: tenants.id });

    const tenant = inserted[0];

    await recordActivity(
      {
        type: "TENANT_CREATED",
        entityType: ENTITY.tenant,
        entityId: tenant.id,
        actorId: context.user.id,
        summary: `${context.user.fullName} registered ${input.name.trim()}`,
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "CREATE",
        entityType: ENTITY.tenant,
        entityId: tenant.id,
        entityLabel: input.name.trim(),
      },
      tx,
    );

    return { id: tenant.id };
  };

  return executor ? run(executor) : db.transaction(run);
}

export type TenantListFilters = {
  search?: string;
  status?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
};

export async function listTenants(context: AccessContext, filters: TenantListFilters = {}) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);

  const conditions: (SQL | undefined)[] = [isNull(tenants.deletedAt)];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    const normalized = normalizeUKPhoneDetailed(filters.search);
    conditions.push(
      or(
        ilike(tenants.name, term),
        ilike(tenants.email, term),
        ilike(tenants.area, term),
        ilike(tenants.requirements, term),
        normalized.ok ? eq(tenants.normalizedPhone, normalized.normalized) : undefined,
      ),
    );
  }

  if (filters.status) {
    conditions.push(eq(tenants.status, filters.status as TenantStatus));
  }
  if (filters.agentId) conditions.push(eq(tenants.ownerAgentId, filters.agentId));

  const where = withVisibility(and(...conditions), tenantVisibilityFilter(context));

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(tenants)
      .where(where)
      .orderBy(desc(tenants.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db.select({ value: count() }).from(tenants).where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(rows.map((row) => row.ownerAgentId));

  return {
    rows: rows.map((row) => ({ ...row, ownerAgent: people.get(row.ownerAgentId) ?? null })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getTenant(id: string, context: AccessContext) {
  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  const tenant = rows[0];
  if (!tenant || tenant.deletedAt) return null;
  if (!canViewTenant(context, tenant)) throw new ForbiddenError();

  const [dealRows, people] = await Promise.all([
    db
      .select({
        id: deals.id,
        stage: deals.stage,
        startedAt: deals.startedAt,
        closedAt: deals.closedAt,
        propertyId: deals.propertyId,
        propertyReference: properties.reference,
        propertyAddress: properties.formattedAddress,
        propertyTitle: properties.title,
        roomName: propertyRooms.name,
      })
      .from(deals)
      .innerJoin(properties, eq(properties.id, deals.propertyId))
      .leftJoin(propertyRooms, eq(propertyRooms.id, deals.roomId))
      .where(eq(deals.tenantId, id))
      .orderBy(desc(deals.updatedAt)),

    loadPeopleMap([tenant.ownerAgentId, tenant.createdBy]),
  ]);

  return {
    tenant,
    deals: dealRows,
    ownerAgent: people.get(tenant.ownerAgentId) ?? null,
    creator: people.get(tenant.createdBy) ?? null,
    canEdit: canEditTenant(context, tenant),
  };
}

/**
 * A tenant registering through the public website.
 *
 * There is no signed-in user behind this, so it cannot go through
 * createTenant. The registration is owned by an administrator until somebody
 * picks it up, and every admin and agent is notified - a lead that lands in
 * the database and nowhere else is a lead nobody works.
 *
 * An existing tenant on the same number is updated rather than duplicated, so
 * a second registration reads as the same person changing their mind.
 */
export async function registerTenantFromWebsite(input: {
  name: string;
  email?: string | null;
  phone: string;
  area?: string | null;
  requirements?: string | null;
  maxBudgetPence?: number | null;
  moveInDate?: string | null;
  propertyTypePreference?: "HOUSE" | "FLAT" | "STUDIO_FLAT" | null;
}): Promise<{ tenantId: string; created: boolean }> {
  const normalization = normalizeUKPhoneDetailed(input.phone);
  if (!normalization.ok) throw new TenantError("Enter a valid UK phone number.");
  if (!input.name.trim()) throw new TenantError("Enter your name.");

  const { normalized, original } = normalization;

  return db.transaction(async (tx) => {
    const owners = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "SUPER_ADMIN"), isNull(users.deletedAt)))
      .limit(1);

    const owner = owners[0];
    if (!owner) throw new TenantError("No administrator is available to receive registrations.");

    const existingRows = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(eq(tenants.normalizedPhone, normalized), isNull(tenants.deletedAt)))
      .limit(1);

    const patch = {
      name: input.name.trim(),
      email: input.email?.trim() || null,
      area: input.area?.trim() || null,
      requirements: input.requirements?.trim() || null,
      maxBudgetPence: input.maxBudgetPence ?? null,
      moveInDate: input.moveInDate || null,
      propertyTypePreference: input.propertyTypePreference ?? null,
    };

    let tenantId: string;
    const created = !existingRows[0];

    if (existingRows[0]) {
      tenantId = existingRows[0].id;
      await tx
        .update(tenants)
        .set({ ...patch, status: "ACTIVE", updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));
    } else {
      const inserted = await tx
        .insert(tenants)
        .values({
          ...patch,
          originalPhone: original,
          normalizedPhone: normalized,
          ownerAgentId: owner.id,
          createdBy: owner.id,
          status: "ACTIVE",
        })
        .returning({ id: tenants.id });
      tenantId = inserted[0].id;
    }

    await recordActivity(
      {
        type: "TENANT_CREATED",
        entityType: ENTITY.tenant,
        entityId: tenantId,
        actorId: owner.id,
        summary: `${patch.name} registered through the website`,
      },
      tx,
    );

    const recipients = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.role, ["SUPER_ADMIN", "AGENT"]), isNull(users.deletedAt)));

    await notifyMany(
      recipients.map((row) => row.id),
      {
        type: "USER_ASSIGNED",
        title: created ? "New tenant registration" : "Tenant registration updated",
        body: [patch.name, patch.area, patch.requirements].filter(Boolean).join(" - ").slice(0, 180),
        href: `/tenants/${tenantId}`,
        entityType: ENTITY.tenant,
        entityId: tenantId,
      },
      tx,
    );

    return { tenantId, created };
  });
}

export async function updateTenant(
  id: string,
  input: Partial<CreateTenantInput> & { status?: TenantStatus },
  context: AccessContext,
): Promise<void> {
  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  const tenant = rows[0];
  if (!tenant || tenant.deletedAt) throw new TenantError("That tenant no longer exists.");
  if (!canEditTenant(context, tenant)) throw new ForbiddenError();

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    if (!input.name.trim()) throw new TenantError("Enter the tenant name.");
    patch.name = input.name.trim();
  }
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.area !== undefined) patch.area = input.area?.trim() || null;
  if (input.roomType !== undefined) patch.roomType = input.roomType?.trim() || null;
  if (input.occupants !== undefined) patch.occupants = input.occupants?.trim() || null;
  if (input.monthlyIncomePence !== undefined) patch.monthlyIncomePence = input.monthlyIncomePence;
  if (input.occupation !== undefined) patch.occupation = input.occupation?.trim() || null;
  if (input.countryOfOrigin !== undefined) {
    patch.countryOfOrigin = input.countryOfOrigin?.trim() || null;
  }
  if (input.postcodePreferences !== undefined) {
    patch.postcodePreferences = input.postcodePreferences?.trim().toUpperCase() || null;
  }
  if (input.requirements !== undefined) patch.requirements = input.requirements?.trim() || null;
  if (input.minBudgetPence !== undefined) patch.minBudgetPence = input.minBudgetPence;
  if (input.maxBudgetPence !== undefined) patch.maxBudgetPence = input.maxBudgetPence;
  if (input.moveInDate !== undefined) patch.moveInDate = input.moveInDate || null;
  if (input.propertyTypePreference !== undefined) {
    patch.propertyTypePreference = input.propertyTypePreference;
  }
  if (input.bedrooms !== undefined) patch.bedrooms = input.bedrooms;
  if (input.status !== undefined) patch.status = input.status;

  if (input.phone !== undefined) {
    const normalization = normalizeUKPhoneDetailed(input.phone);
    if (!normalization.ok) throw new TenantError(PHONE_ERROR_MESSAGES[normalization.reason]);
    patch.originalPhone = normalization.original;
    patch.normalizedPhone = normalization.normalized;
  }

  await db.transaction(async (tx) => {
    await tx.update(tenants).set(patch).where(eq(tenants.id, id));

    await recordAudit(
      {
        user: context.user,
        action: "UPDATE",
        entityType: ENTITY.tenant,
        entityId: id,
        entityLabel: tenant.name,
        before: { name: tenant.name, status: tenant.status },
        after: patch,
      },
      tx,
    );
  });
}

/**
 * Move a tenant to a different owning agent.
 *
 * Admin only and a reason is required. A tenant belongs to whoever registered
 * them, and that ownership decides who sees them and who is credited on a
 * cross sell, so moving one is a deliberate act rather than an edit.
 */
export async function reassignTenant(
  id: string,
  agentId: string,
  reason: string,
  context: AccessContext,
): Promise<void> {
  if (!context.isAdmin) throw new ForbiddenError();
  if (!reason.trim()) throw new TenantError("Give a reason for the reassignment.");

  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  const tenant = rows[0];
  if (!tenant || tenant.deletedAt) throw new TenantError("That tenant no longer exists.");

  await db.transaction(async (tx) => {
    await tx
      .update(tenants)
      .set({ ownerAgentId: agentId, updatedAt: new Date() })
      .where(eq(tenants.id, id));

    await recordActivity(
      {
        type: "TENANT_CREATED",
        entityType: ENTITY.tenant,
        entityId: id,
        actorId: context.user.id,
        summary: `${context.user.fullName} reassigned ${tenant.name}`,
        metadata: { reason },
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "REASSIGN",
        entityType: ENTITY.tenant,
        entityId: id,
        entityLabel: tenant.name,
        before: { ownerAgentId: tenant.ownerAgentId },
        after: { ownerAgentId: agentId },
        metadata: { reason },
      },
      tx,
    );
  });
}

export async function archiveTenant(id: string, context: AccessContext): Promise<void> {
  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  const tenant = rows[0];
  if (!tenant) throw new TenantError("That tenant no longer exists.");
  if (!canEditTenant(context, tenant)) throw new ForbiddenError();

  const liveDeals = await db
    .select({ value: count() })
    .from(deals)
    .where(
      and(
        eq(deals.tenantId, id),
        or(eq(deals.stage, "VIEWING"), eq(deals.stage, "VERIFICATION"), eq(deals.stage, "CLOSING")),
      ),
    );

  if (Number(liveDeals[0]?.value ?? 0) > 0) {
    throw new TenantError("This tenant has a live deal. Close or cancel it before archiving.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(tenants)
      .set({ deletedAt: new Date(), deletedBy: context.user.id, status: "INACTIVE" })
      .where(eq(tenants.id, id));

    await recordAudit(
      {
        user: context.user,
        action: "ARCHIVE",
        entityType: ENTITY.tenant,
        entityId: id,
        entityLabel: tenant.name,
      },
      tx,
    );
  });
}

/** Active applicants belonging to this agent, for viewing and cross-sell pickers. */
export async function listSelectableTenants(context: AccessContext) {
  const where = withVisibility(
    and(
      isNull(tenants.deletedAt),
      or(eq(tenants.status, "ACTIVE"), eq(tenants.status, "VIEWING"), eq(tenants.status, "NEGOTIATING")),
    ),
    tenantVisibilityFilter(context),
  );

  return db
    .select({
      id: tenants.id,
      name: tenants.name,
      area: tenants.area,
      maxBudgetPence: tenants.maxBudgetPence,
      status: tenants.status,
    })
    .from(tenants)
    .where(where)
    .orderBy(tenants.name)
    .limit(200);
}
