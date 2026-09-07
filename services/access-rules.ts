/**
 * The ownership rules, as pure functions.
 *
 * Kept free of database and server-only imports so they can be unit tested
 * directly. `services/permissions.ts` wraps these with the session and the
 * SQL scope filters; this file is where the rules themselves live.
 */

export type Role = "SUPER_ADMIN" | "AGENT" | "FRONTER";

/** The parts of a signed-in user that any rule is allowed to consider. */
export type Actor = {
  id: string;
  role: Role;
  /** Fronters reporting to this user (agents only). */
  teamFronterIds: string[];
  /** The agent this user reports to (fronters only). */
  managingAgentId: string | null;
};

export type OwnedRecord = {
  createdBy?: string | null;
  originatingFronterId?: string | null;
  assignedAgentId?: string | null;
};

export type FollowUpRecord = {
  createdById: string;
  agentId: string | null;
};

export type DealRecord = {
  propertyAgentId: string;
  tenantAgentId?: string | null;
  originatingFronterId?: string | null;
};

export const isAdmin = (actor: Actor) => actor.role === "SUPER_ADMIN";
export const isAgent = (actor: Actor) => actor.role === "AGENT";
export const isFronter = (actor: Actor) => actor.role === "FRONTER";

/**
 * The shared ownership test for landlords and properties.
 *
 * An admin sees everything. An agent sees what is assigned to them and
 * anything their fronters originated or created. A fronter sees only their
 * own work - never another fronter's, even on the same team.
 */
export function ownsRecord(actor: Actor, record: OwnedRecord): boolean {
  if (isAdmin(actor)) return true;

  if (isAgent(actor)) {
    if (record.assignedAgentId === actor.id) return true;
    if (record.originatingFronterId && actor.teamFronterIds.includes(record.originatingFronterId)) {
      return true;
    }
    if (record.createdBy && actor.teamFronterIds.includes(record.createdBy)) return true;
    return record.createdBy === actor.id;
  }

  return record.originatingFronterId === actor.id || record.createdBy === actor.id;
}

/** Publishing to the public website is an agent or admin action. */
export function canPublish(actor: Actor, record: OwnedRecord): boolean {
  if (isAdmin(actor)) return true;
  if (!isAgent(actor)) return false;
  return ownsRecord(actor, record);
}

/** Tenants belong to the agent who registered them. Fronters have no access. */
export function canAccessTenant(actor: Actor, tenant: { ownerAgentId: string }): boolean {
  if (isAdmin(actor)) return true;
  if (isAgent(actor)) return tenant.ownerAgentId === actor.id;
  return false;
}

/**
 * A scheduled follow-up is visible to its owner, to the agent it rolls up to,
 * to that agent's team lead, and to an admin.
 */
export function canSeeFollowUp(actor: Actor, followUp: FollowUpRecord): boolean {
  if (isAdmin(actor)) return true;
  if (followUp.createdById === actor.id) return true;
  if (isAgent(actor)) {
    return followUp.agentId === actor.id || actor.teamFronterIds.includes(followUp.createdById);
  }
  return false;
}

/**
 * Taking over another user's follow-up. Never available to a fronter: this is
 * the rule that stops one fronter claiming another's prospect.
 */
export function canOverrideLock(actor: Actor, followUp: FollowUpRecord): boolean {
  if (isAdmin(actor)) return true;
  if (!isAgent(actor)) return false;
  return followUp.agentId === actor.id || actor.teamFronterIds.includes(followUp.createdById);
}

/** Continuing a follow-up: the owner always may, anyone else needs override. */
export function canContinueFollowUp(actor: Actor, followUp: FollowUpRecord): boolean {
  if (followUp.createdById === actor.id) return true;
  return canOverrideLock(actor, followUp);
}

/** A fronter follows the deals on properties they originated, read-only. */
export function canSeeDeal(actor: Actor, deal: DealRecord): boolean {
  if (isAdmin(actor)) return true;
  if (isAgent(actor)) {
    return deal.propertyAgentId === actor.id || deal.tenantAgentId === actor.id;
  }
  return deal.originatingFronterId === actor.id;
}

/** Driving a deal through the pipeline is an agent or admin action. */
export function canDriveDeal(actor: Actor, deal: DealRecord): boolean {
  if (isAdmin(actor)) return true;
  if (!isAgent(actor)) return false;
  return deal.propertyAgentId === actor.id || deal.tenantAgentId === actor.id;
}

/** Everyone sees what they personally earned; only admins see company figures. */
export function canSeeCommission(
  actor: Actor,
  commission: { beneficiaryUserId: string | null },
): boolean {
  if (isAdmin(actor)) return true;
  return commission.beneficiaryUserId === actor.id;
}

export const canSeeCompanyFinancials = isAdmin;

/** Customer chat never reaches a fronter. */
export function canUseCustomerChat(actor: Actor): boolean {
  return isAdmin(actor) || isAgent(actor);
}

export function canUseCrossSell(actor: Actor): boolean {
  return isAdmin(actor) || isAgent(actor);
}
