import "server-only";
import { cache } from "react";
import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  deals,
  followUps,
  landlords,
  properties,
  tenants,
  users,
  type Deal,
  type FollowUp,
  type Landlord,
  type Property,
  type Tenant,
} from "@/db/schema";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import * as rules from "./access-rules";
import type { Actor } from "./access-rules";

/**
 * Every authorisation decision in the portal is made here. Pages and route
 * handlers ask this module; they never re-implement a role check inline.
 *
 * Two layers work together:
 *  - `can*` predicates, for a record already loaded.
 *  - `*VisibilityFilter` helpers, which push the same rules into SQL so a user
 *    can never even fetch rows outside their scope.
 */

export type Role = SessionUser["role"];

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "You need to sign in.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/**
 * The signed-in user plus the team graph their permissions depend on.
 * Cached per request: an agent's fronter list is looked up once.
 */
export type AccessContext = {
  user: SessionUser;
  isAdmin: boolean;
  isAgent: boolean;
  isFronter: boolean;
  /** Fronters reporting to this agent (empty for fronters and admins). */
  teamFronterIds: string[];
  /** For a fronter, the agent they report to. */
  managingAgentId: string | null;
  /** Every user id whose work this user may see: self plus team. */
  scopeUserIds: string[];
};

export const getAccessContext = cache(async (): Promise<AccessContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  return buildAccessContext(user);
});

export async function buildAccessContext(user: SessionUser): Promise<AccessContext> {
  const isAdmin = user.role === "SUPER_ADMIN";
  const isAgent = user.role === "AGENT";
  const isFronter = user.role === "FRONTER";

  let teamFronterIds: string[] = [];
  if (isAgent) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.assignedAgentId, user.id), eq(users.role, "FRONTER"), isNull(users.deletedAt)),
      );
    teamFronterIds = rows.map((row) => row.id);
  }

  return {
    user,
    isAdmin,
    isAgent,
    isFronter,
    teamFronterIds,
    managingAgentId: isFronter ? user.assignedAgentId : null,
    scopeUserIds: [user.id, ...teamFronterIds],
  };
}

/** Throws when there is no session. Use at the top of every protected action. */
export async function requireAccess(): Promise<AccessContext> {
  const context = await getAccessContext();
  if (!context) throw new UnauthenticatedError();
  return context;
}

export async function requireRole(...roles: Role[]): Promise<AccessContext> {
  const context = await requireAccess();
  if (!roles.includes(context.user.role)) throw new ForbiddenError();
  return context;
}

export async function requireAdmin(): Promise<AccessContext> {
  return requireRole("SUPER_ADMIN");
}

/** Agents and admins. Fronters do not run the letting pipeline. */
export async function requireAgentOrAdmin(): Promise<AccessContext> {
  return requireRole("SUPER_ADMIN", "AGENT");
}

/** The context reduced to what the pure rules are allowed to see. */
function actorOf(context: AccessContext): Actor {
  return {
    id: context.user.id,
    role: context.user.role,
    teamFronterIds: context.teamFronterIds,
    managingAgentId: context.managingAgentId,
  };
}

/* ------------------------------------------------------------- predicates */

type OwnedRecord = rules.OwnedRecord;

export function canViewLandlord(context: AccessContext, landlord: OwnedRecord): boolean {
  return rules.ownsRecord(actorOf(context), landlord);
}

export function canEditLandlord(context: AccessContext, landlord: OwnedRecord): boolean {
  return rules.ownsRecord(actorOf(context), landlord);
}

/**
 * The landlord phone is the system identity key, so correcting it is an admin
 * action that always writes an audit entry.
 */
export function canCorrectLandlordPhone(context: AccessContext): boolean {
  return context.isAdmin;
}

export function canViewProperty(context: AccessContext, property: OwnedRecord): boolean {
  return rules.ownsRecord(actorOf(context), property);
}

export function canEditProperty(context: AccessContext, property: OwnedRecord): boolean {
  return rules.ownsRecord(actorOf(context), property);
}

export function canPublishProperty(context: AccessContext, property: OwnedRecord): boolean {
  return rules.canPublish(actorOf(context), property);
}

export function canArchiveProperty(context: AccessContext, property: OwnedRecord): boolean {
  if (context.isAdmin) return true;
  return context.isAgent && rules.ownsRecord(actorOf(context), property);
}

export function canViewTenant(
  context: AccessContext,
  tenant: Pick<Tenant, "ownerAgentId">,
): boolean {
  return rules.canAccessTenant(actorOf(context), tenant);
}

export function canEditTenant(
  context: AccessContext,
  tenant: Pick<Tenant, "ownerAgentId">,
): boolean {
  return rules.canAccessTenant(actorOf(context), tenant);
}

export function canViewFollowUp(
  context: AccessContext,
  followUp: Pick<FollowUp, "createdById" | "agentId">,
): boolean {
  return rules.canSeeFollowUp(actorOf(context), followUp);
}

export function canRetryFollowUp(
  context: AccessContext,
  followUp: Pick<FollowUp, "createdById" | "agentId">,
): boolean {
  return rules.canContinueFollowUp(actorOf(context), followUp);
}

export function canOverrideFollowUpLock(
  context: AccessContext,
  followUp: Pick<FollowUp, "createdById" | "agentId">,
): boolean {
  return rules.canOverrideLock(actorOf(context), followUp);
}

export function canViewDeal(
  context: AccessContext,
  deal: Pick<Deal, "propertyAgentId" | "tenantAgentId" | "originatingFronterId">,
): boolean {
  return rules.canSeeDeal(actorOf(context), deal);
}

export function canManageDeal(
  context: AccessContext,
  deal: Pick<Deal, "propertyAgentId" | "tenantAgentId">,
): boolean {
  return rules.canDriveDeal(actorOf(context), deal);
}

export function canViewCommission(
  context: AccessContext,
  commission: { beneficiaryUserId: string | null },
): boolean {
  return rules.canSeeCommission(actorOf(context), commission);
}

export function canViewCompanyFinancials(context: AccessContext): boolean {
  return context.isAdmin;
}

export function canManageUsers(context: AccessContext): boolean {
  return context.isAdmin;
}

export function canManageSettings(context: AccessContext): boolean {
  return context.isAdmin;
}

export function canViewAuditLog(context: AccessContext): boolean {
  return context.isAdmin;
}

export function canAccessCustomerChat(context: AccessContext): boolean {
  return rules.canUseCustomerChat(actorOf(context));
}

export function canAccessCrossSell(context: AccessContext): boolean {
  return rules.canUseCrossSell(actorOf(context));
}

/* -------------------------------------------------------- SQL scope filters */

/**
 * These push the ownership rules into the query itself. A handler that uses
 * them cannot accidentally return a row the user is not allowed to see.
 * Returns undefined for admins, meaning "no restriction".
 */

export function landlordVisibilityFilter(context: AccessContext): SQL | undefined {
  if (context.isAdmin) return undefined;
  if (context.isAgent) {
    const ids = context.scopeUserIds;
    return or(
      eq(landlords.assignedAgentId, context.user.id),
      inArray(landlords.originatingFronterId, ids),
      inArray(landlords.createdBy, ids),
    );
  }
  return or(
    eq(landlords.originatingFronterId, context.user.id),
    eq(landlords.createdBy, context.user.id),
  );
}

export function propertyVisibilityFilter(context: AccessContext): SQL | undefined {
  if (context.isAdmin) return undefined;
  if (context.isAgent) {
    const ids = context.scopeUserIds;
    return or(
      eq(properties.assignedAgentId, context.user.id),
      inArray(properties.originatingFronterId, ids),
      inArray(properties.createdBy, ids),
    );
  }
  return or(
    eq(properties.originatingFronterId, context.user.id),
    eq(properties.createdBy, context.user.id),
  );
}

export function tenantVisibilityFilter(context: AccessContext): SQL | undefined {
  if (context.isAdmin) return undefined;
  if (context.isAgent) return eq(tenants.ownerAgentId, context.user.id);
  // Fronters have no tenant access.
  return eq(tenants.id, "00000000-0000-0000-0000-000000000000");
}

export function dealVisibilityFilter(context: AccessContext): SQL | undefined {
  if (context.isAdmin) return undefined;
  if (context.isAgent) {
    return or(
      eq(deals.propertyAgentId, context.user.id),
      eq(deals.tenantAgentId, context.user.id),
    );
  }
  return eq(deals.originatingFronterId, context.user.id);
}

export function followUpVisibilityFilter(context: AccessContext): SQL | undefined {
  if (context.isAdmin) return undefined;
  if (context.isAgent) {
    return or(
      eq(followUps.agentId, context.user.id),
      inArray(followUps.createdById, context.scopeUserIds),
    );
  }
  return eq(followUps.createdById, context.user.id);
}

/** Convenience for the common `and(baseFilter, visibility)` pattern. */
export function withVisibility(
  base: SQL | undefined,
  visibility: SQL | undefined,
): SQL | undefined {
  if (base && visibility) return and(base, visibility);
  return base ?? visibility;
}

export type { Landlord, Property, Tenant, Deal, FollowUp };
