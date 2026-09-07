import "server-only";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sum,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  calls,
  commissions,
  customerConversations,
  deals,
  followUps,
  landlords,
  properties,
  sales,
  tenants,
} from "@/db/schema";
import { startOfDay } from "@/lib/dates";
import {
  dealVisibilityFilter,
  followUpVisibilityFilter,
  landlordVisibilityFilter,
  propertyVisibilityFilter,
  tenantVisibilityFilter,
  withVisibility,
  type AccessContext,
} from "./permissions";

/**
 * Dashboard metrics. Every query is scoped through the permission filters, so
 * a fronter's totals only ever count their own work and an agent's only their
 * team's - the numbers cannot leak what the lists would not show.
 */

export type DashboardMetrics = {
  callsToday: number;
  callsYesterday: number;
  interestedToday: number;
  followUpsDue: number;
  followUpsOverdue: number;
  landlords: number;
  properties: number;
  publishedProperties: number;
  tenants: number;
  activeViewings: number;
  activeVerifications: number;
  activeClosings: number;
  closedSales: number;
  myCommissionPence: number;
  openCustomerChats: number;
};

function todayRange() {
  const now = new Date();
  const from = startOfDay(now);
  return { from, to: now };
}

function yesterdayRange() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const from = startOfDay(yesterday);
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** Calls a user may count: their own, plus their team if they manage one. */
function callScope(context: AccessContext): SQL | undefined {
  if (context.isAdmin) return undefined;
  if (context.isAgent) {
    // Calls made by this agent or by any fronter reporting to them.
    return or(
      inArray(calls.calledById, context.scopeUserIds),
      eq(calls.agentId, context.user.id),
    );
  }
  return eq(calls.calledById, context.user.id);
}

export async function getDashboardMetrics(context: AccessContext): Promise<DashboardMetrics> {
  const today = todayRange();
  const yesterday = yesterdayRange();
  const now = new Date();
  const scope = callScope(context);

  const [
    callsTodayRows,
    callsYesterdayRows,
    interestedRows,
    followUpsDueRows,
    followUpsOverdueRows,
    landlordRows,
    propertyRows,
    publishedRows,
    tenantRows,
    viewingRows,
    verificationRows,
    closingRows,
    saleRows,
    commissionRows,
    chatRows,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(calls)
      .where(and(gte(calls.startedAt, today.from), lte(calls.startedAt, today.to), scope)),

    db
      .select({ value: count() })
      .from(calls)
      .where(and(gte(calls.startedAt, yesterday.from), lte(calls.startedAt, yesterday.to), scope)),

    db
      .select({ value: count() })
      .from(calls)
      .where(
        and(
          gte(calls.startedAt, today.from),
          lte(calls.startedAt, today.to),
          eq(calls.outcome, "INTERESTED"),
          scope,
        ),
      ),

    db
      .select({ value: count() })
      .from(followUps)
      .where(
        and(
          eq(followUps.status, "SCHEDULED"),
          lte(followUps.dueAt, today.to),
          followUpVisibilityFilter(context),
        ),
      ),

    db
      .select({ value: count() })
      .from(followUps)
      .where(
        and(
          eq(followUps.status, "SCHEDULED"),
          lte(followUps.dueAt, now),
          followUpVisibilityFilter(context),
        ),
      ),

    db
      .select({ value: count() })
      .from(landlords)
      .where(withVisibility(isNull(landlords.deletedAt), landlordVisibilityFilter(context))),

    db
      .select({ value: count() })
      .from(properties)
      .where(withVisibility(isNull(properties.deletedAt), propertyVisibilityFilter(context))),

    db
      .select({ value: count() })
      .from(properties)
      .where(
        and(
          isNull(properties.deletedAt),
          eq(properties.listingStatus, "PUBLISHED"),
          propertyVisibilityFilter(context),
        ),
      ),

    context.isFronter
      ? Promise.resolve([{ value: 0 }])
      : db
          .select({ value: count() })
          .from(tenants)
          .where(withVisibility(isNull(tenants.deletedAt), tenantVisibilityFilter(context))),

    db
      .select({ value: count() })
      .from(deals)
      .where(and(eq(deals.stage, "VIEWING"), dealVisibilityFilter(context))),

    db
      .select({ value: count() })
      .from(deals)
      .where(and(eq(deals.stage, "VERIFICATION"), dealVisibilityFilter(context))),

    db
      .select({ value: count() })
      .from(deals)
      .where(and(eq(deals.stage, "CLOSING"), dealVisibilityFilter(context))),

    db
      .select({ value: count() })
      .from(deals)
      .where(and(eq(deals.stage, "CLOSED_SUCCESSFUL"), dealVisibilityFilter(context))),

    /* Personal earnings. Admins see the company total instead, on their own
       dashboard - this figure is always "what I earned". */
    db
      .select({ value: sum(commissions.amountPence) })
      .from(commissions)
      .where(eq(commissions.beneficiaryUserId, context.user.id)),

    context.isFronter
      ? Promise.resolve([{ value: 0 }])
      : db
          .select({ value: count() })
          .from(customerConversations)
          .where(
            context.isAdmin
              ? eq(customerConversations.status, "NEW")
              : and(
                  eq(customerConversations.assignedAgentId, context.user.id),
                  eq(customerConversations.status, "NEW"),
                ),
          ),
  ]);

  return {
    callsToday: Number(callsTodayRows[0]?.value ?? 0),
    callsYesterday: Number(callsYesterdayRows[0]?.value ?? 0),
    interestedToday: Number(interestedRows[0]?.value ?? 0),
    followUpsDue: Number(followUpsDueRows[0]?.value ?? 0),
    followUpsOverdue: Number(followUpsOverdueRows[0]?.value ?? 0),
    landlords: Number(landlordRows[0]?.value ?? 0),
    properties: Number(propertyRows[0]?.value ?? 0),
    publishedProperties: Number(publishedRows[0]?.value ?? 0),
    tenants: Number(tenantRows[0]?.value ?? 0),
    activeViewings: Number(viewingRows[0]?.value ?? 0),
    activeVerifications: Number(verificationRows[0]?.value ?? 0),
    activeClosings: Number(closingRows[0]?.value ?? 0),
    closedSales: Number(saleRows[0]?.value ?? 0),
    myCommissionPence: Number(commissionRows[0]?.value ?? 0),
    openCustomerChats: Number(chatRows[0]?.value ?? 0),
  };
}

/** Follow-ups due today or already overdue, soonest first. */
export async function getDueFollowUps(context: AccessContext, limit = 6) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return db
    .select({
      id: followUps.id,
      contactName: followUps.contactName,
      originalPhone: followUps.originalPhone,
      normalizedPhone: followUps.normalizedPhone,
      dueAt: followUps.dueAt,
      priority: followUps.priority,
      notes: followUps.notes,
      createdById: followUps.createdById,
    })
    .from(followUps)
    .where(
      and(
        eq(followUps.status, "SCHEDULED"),
        lte(followUps.dueAt, end),
        followUpVisibilityFilter(context),
      ),
    )
    .orderBy(followUps.dueAt)
    .limit(limit);
}

export async function getRecentCalls(context: AccessContext, limit = 6) {
  return db
    .select({
      id: calls.id,
      originalPhone: calls.originalPhone,
      normalizedPhone: calls.normalizedPhone,
      outcome: calls.outcome,
      status: calls.status,
      startedAt: calls.startedAt,
      landlordId: calls.landlordId,
    })
    .from(calls)
    .where(callScope(context))
    .orderBy(desc(calls.startedAt))
    .limit(limit);
}

export async function getPipelineDeals(context: AccessContext, limit = 8) {
  return db
    .select({
      id: deals.id,
      stage: deals.stage,
      propertyId: deals.propertyId,
      updatedAt: deals.updatedAt,
      propertyReference: properties.reference,
      propertyAddress: properties.formattedAddress,
      propertyTitle: properties.title,
    })
    .from(deals)
    .innerJoin(properties, eq(properties.id, deals.propertyId))
    .where(
      and(
        dealVisibilityFilter(context),
        // Live pipeline only - closed deals belong on the sales screen.
        inArray(deals.stage, ["VIEWING", "VERIFICATION", "CLOSING"]),
      ),
    )
    .orderBy(desc(deals.updatedAt))
    .limit(limit);
}

export async function getRecentSales(context: AccessContext, limit = 5) {
  const visibility = context.isAdmin
    ? undefined
    : dealVisibilityFilter(context);

  return db
    .select({
      id: sales.id,
      reference: sales.reference,
      closingDate: sales.closingDate,
      grossCommissionPence: sales.grossCommissionPence,
      propertyId: sales.propertyId,
      propertyAddress: properties.formattedAddress,
    })
    .from(sales)
    .innerJoin(properties, eq(properties.id, sales.propertyId))
    .innerJoin(deals, eq(deals.id, sales.dealId))
    .where(visibility)
    .orderBy(desc(sales.closingDate))
    .limit(limit);
}
