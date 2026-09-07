import "server-only";
import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql as raw,
  sum,
  type SQL,
} from "drizzle-orm";
import { db, executeRows } from "@/db";
import {
  calls,
  commissions,
  deals,
  followUps,
  landlords,
  properties,
  sales,
  users,
} from "@/db/schema";
import { endOfDay, startOfDay } from "@/lib/dates";
import type { AccessContext } from "./permissions";

/**
 * Reporting.
 *
 * Every figure is scoped to what the viewer is allowed to see: a fronter's
 * report covers their own work, an agent's covers their team, an
 * administrator's covers the business.
 */

export type ReportRange = { from: Date; to: Date; label: string };

export function resolveReportRange(
  preset: string | undefined,
  from?: string,
  to?: string,
): ReportRange {
  const now = new Date();

  if (preset === "custom" && from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      return { from: startOfDay(fromDate), to: endOfDay(toDate), label: "Custom range" };
    }
  }

  switch (preset) {
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday), label: "Yesterday" };
    }
    case "week": {
      const start = new Date(now);
      // Monday-based, because the business reports Monday to Sunday.
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      return { from: startOfDay(start), to: endOfDay(now), label: "This week" };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(start), to: endOfDay(now), label: "This month" };
    }
    case "today":
    default:
      return { from: startOfDay(now), to: endOfDay(now), label: "Today" };
  }
}

/** The set of users a report may cover. */
function reportUserIds(context: AccessContext): string[] | null {
  if (context.isAdmin) return null; // everyone
  if (context.isAgent) return context.scopeUserIds;
  return [context.user.id];
}

function scopedTo(column: Parameters<typeof inArray>[0], ids: string[] | null): SQL | undefined {
  if (!ids) return undefined;
  return inArray(column, ids);
}

export type DailyReport = {
  range: ReportRange;
  totalCalls: number;
  interested: number;
  notInterested: number;
  followUpsCreated: number;
  noAnswer: number;
  landlordsAdded: number;
  propertiesAdded: number;
  propertiesPublished: number;
  viewingsCreated: number;
  successfulSales: number;
  grossCommissionPence: number;
  myCommissionPence: number;
  conversionRate: number;
};

export async function getDailyReport(
  context: AccessContext,
  range: ReportRange,
): Promise<DailyReport> {
  const ids = reportUserIds(context);
  const inRange = and(gte(calls.startedAt, range.from), lte(calls.startedAt, range.to));

  const callScope = ids
    ? or(inArray(calls.calledById, ids), eq(calls.agentId, context.user.id))
    : undefined;

  const [
    callRows,
    interestedRows,
    notInterestedRows,
    followUpRows,
    noAnswerRows,
    landlordRows,
    propertyRows,
    publishedRows,
    viewingRows,
    saleRows,
    commissionRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(calls).where(and(inRange, callScope)),

    db
      .select({ value: count() })
      .from(calls)
      .where(and(inRange, eq(calls.outcome, "INTERESTED"), callScope)),

    db
      .select({ value: count() })
      .from(calls)
      .where(and(inRange, eq(calls.outcome, "NOT_INTERESTED"), callScope)),

    db
      .select({ value: count() })
      .from(followUps)
      .where(
        and(
          gte(followUps.createdAt, range.from),
          lte(followUps.createdAt, range.to),
          scopedTo(followUps.createdById, ids),
        ),
      ),

    db
      .select({ value: count() })
      .from(calls)
      .where(and(inRange, eq(calls.outcome, "NO_ANSWER"), callScope)),

    db
      .select({ value: count() })
      .from(landlords)
      .where(
        and(
          gte(landlords.createdAt, range.from),
          lte(landlords.createdAt, range.to),
          isNull(landlords.deletedAt),
          scopedTo(landlords.createdBy, ids),
        ),
      ),

    db
      .select({ value: count() })
      .from(properties)
      .where(
        and(
          gte(properties.createdAt, range.from),
          lte(properties.createdAt, range.to),
          isNull(properties.deletedAt),
          scopedTo(properties.createdBy, ids),
        ),
      ),

    db
      .select({ value: count() })
      .from(properties)
      .where(
        and(
          gte(properties.publishedAt, range.from),
          lte(properties.publishedAt, range.to),
          isNull(properties.deletedAt),
          ids ? inArray(properties.publishedById, ids) : undefined,
        ),
      ),

    db
      .select({ value: count() })
      .from(deals)
      .where(
        and(
          gte(deals.startedAt, range.from),
          lte(deals.startedAt, range.to),
          ids
            ? or(
                inArray(deals.propertyAgentId, ids),
                inArray(deals.originatingFronterId, ids),
              )
            : undefined,
        ),
      ),

    db
      .select({ value: count(), gross: sum(sales.grossCommissionPence) })
      .from(sales)
      .where(
        and(
          gte(sales.closingDate, range.from),
          lte(sales.closingDate, range.to),
          ids
            ? or(
                inArray(sales.propertyAgentId, ids),
                inArray(sales.originatingFronterId, ids),
              )
            : undefined,
        ),
      ),

    db
      .select({ value: sum(commissions.amountPence) })
      .from(commissions)
      .innerJoin(sales, eq(sales.id, commissions.saleId))
      .where(
        and(
          eq(commissions.beneficiaryUserId, context.user.id),
          gte(sales.closingDate, range.from),
          lte(sales.closingDate, range.to),
        ),
      ),
  ]);

  const totalCalls = Number(callRows[0]?.value ?? 0);
  const interested = Number(interestedRows[0]?.value ?? 0);

  return {
    range,
    totalCalls,
    interested,
    notInterested: Number(notInterestedRows[0]?.value ?? 0),
    followUpsCreated: Number(followUpRows[0]?.value ?? 0),
    noAnswer: Number(noAnswerRows[0]?.value ?? 0),
    landlordsAdded: Number(landlordRows[0]?.value ?? 0),
    propertiesAdded: Number(propertyRows[0]?.value ?? 0),
    propertiesPublished: Number(publishedRows[0]?.value ?? 0),
    viewingsCreated: Number(viewingRows[0]?.value ?? 0),
    successfulSales: Number(saleRows[0]?.value ?? 0),
    grossCommissionPence: Number(saleRows[0]?.gross ?? 0),
    myCommissionPence: Number(commissionRows[0]?.value ?? 0),
    conversionRate: totalCalls === 0 ? 0 : Math.round((interested / totalCalls) * 100),
  };
}

/* ---------------------------------------------------------- performance */

export type PerformanceRow = {
  userId: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
  calls: number;
  interested: number;
  notInterested: number;
  followUps: number;
  landlordsAdded: number;
  propertiesAdded: number;
  closedSales: number;
  commissionPence: number;
  conversionRate: number;
};

/**
 * Per-person performance for the range. Admins see everyone, agents see
 * themselves and their fronters.
 */
export async function getPerformance(
  context: AccessContext,
  range: ReportRange,
): Promise<PerformanceRow[]> {
  const ids = reportUserIds(context);

  const people = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.status, "ACTIVE"),
        ids ? inArray(users.id, ids) : undefined,
      ),
    )
    .orderBy(users.fullName);

  if (people.length === 0) return [];

  const userIds = people.map((person) => person.id);

  const [callStats, landlordStats, propertyStats, saleStats, commissionStats, followUpStats] =
    await Promise.all([
      db
        .select({ userId: calls.calledById, total: count() })
        .from(calls)
        .where(
          and(
            gte(calls.startedAt, range.from),
            lte(calls.startedAt, range.to),
            inArray(calls.calledById, userIds),
          ),
        )
        .groupBy(calls.calledById),

      db
        .select({ userId: landlords.createdBy, total: count() })
        .from(landlords)
        .where(
          and(
            gte(landlords.createdAt, range.from),
            lte(landlords.createdAt, range.to),
            isNull(landlords.deletedAt),
            inArray(landlords.createdBy, userIds),
          ),
        )
        .groupBy(landlords.createdBy),

      db
        .select({ userId: properties.createdBy, total: count() })
        .from(properties)
        .where(
          and(
            gte(properties.createdAt, range.from),
            lte(properties.createdAt, range.to),
            isNull(properties.deletedAt),
            inArray(properties.createdBy, userIds),
          ),
        )
        .groupBy(properties.createdBy),

      db
        .select({ userId: sales.propertyAgentId, total: count() })
        .from(sales)
        .where(
          and(
            gte(sales.closingDate, range.from),
            lte(sales.closingDate, range.to),
            inArray(sales.propertyAgentId, userIds),
          ),
        )
        .groupBy(sales.propertyAgentId),

      db
        .select({ userId: commissions.beneficiaryUserId, total: sum(commissions.amountPence) })
        .from(commissions)
        .innerJoin(sales, eq(sales.id, commissions.saleId))
        .where(
          and(
            gte(sales.closingDate, range.from),
            lte(sales.closingDate, range.to),
            inArray(commissions.beneficiaryUserId, userIds),
          ),
        )
        .groupBy(commissions.beneficiaryUserId),

      db
        .select({ userId: followUps.createdById, total: count() })
        .from(followUps)
        .where(
          and(
            gte(followUps.createdAt, range.from),
            lte(followUps.createdAt, range.to),
            inArray(followUps.createdById, userIds),
          ),
        )
        .groupBy(followUps.createdById),
    ]);

  // Interested and not-interested need their own grouped counts.
  const [interestedStats, notInterestedStats] = await Promise.all([
    db
      .select({ userId: calls.calledById, total: count() })
      .from(calls)
      .where(
        and(
          gte(calls.startedAt, range.from),
          lte(calls.startedAt, range.to),
          eq(calls.outcome, "INTERESTED"),
          inArray(calls.calledById, userIds),
        ),
      )
      .groupBy(calls.calledById),

    db
      .select({ userId: calls.calledById, total: count() })
      .from(calls)
      .where(
        and(
          gte(calls.startedAt, range.from),
          lte(calls.startedAt, range.to),
          eq(calls.outcome, "NOT_INTERESTED"),
          inArray(calls.calledById, userIds),
        ),
      )
      .groupBy(calls.calledById),
  ]);

  const toMap = <T extends { userId: string | null; total: unknown }>(rows: T[]) =>
    new Map(rows.filter((row) => row.userId).map((row) => [row.userId!, Number(row.total ?? 0)]));

  const callMap = toMap(callStats.map((row) => ({ userId: row.userId, total: row.total })));
  const interestedMap = toMap(interestedStats);
  const notInterestedMap = toMap(notInterestedStats);
  const landlordMap = toMap(landlordStats);
  const propertyMap = toMap(propertyStats);
  const saleMap = toMap(saleStats);
  const commissionMap = toMap(commissionStats);
  const followUpMap = toMap(followUpStats);

  return people.map((person) => {
    const calls = callMap.get(person.id) ?? 0;
    const interested = interestedMap.get(person.id) ?? 0;

    return {
      userId: person.id,
      fullName: person.fullName,
      role: person.role,
      avatarUrl: person.avatarUrl,
      calls,
      interested,
      notInterested: notInterestedMap.get(person.id) ?? 0,
      followUps: followUpMap.get(person.id) ?? 0,
      landlordsAdded: landlordMap.get(person.id) ?? 0,
      propertiesAdded: propertyMap.get(person.id) ?? 0,
      closedSales: saleMap.get(person.id) ?? 0,
      commissionPence: commissionMap.get(person.id) ?? 0,
      conversionRate: calls === 0 ? 0 : Math.round((interested / calls) * 100),
    };
  });
}

/**
 * The acquisition funnel for the range:
 * calls -> interested -> property added -> viewing -> sale.
 */
export async function getFunnel(context: AccessContext, range: ReportRange) {
  const report = await getDailyReport(context, range);

  return [
    { label: "Calls", value: report.totalCalls },
    { label: "Interested", value: report.interested },
    { label: "Properties added", value: report.propertiesAdded },
    { label: "Viewings", value: report.viewingsCreated },
    { label: "Sales", value: report.successfulSales },
  ];
}

export type TrendPoint = { day: string; total: number };

/**
 * Daily call counts for the trend chart. Aggregated in one grouped query and
 * then filled in, so days with no calls still appear as zero rather than
 * silently collapsing the chart.
 */
export async function getCallTrend(
  context: AccessContext,
  days = 14,
): Promise<TrendPoint[]> {
  const ids = reportUserIds(context);
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - (days - 1));

  // The window is expressed in days rather than as a Date parameter: a JS Date
  // interpolated into a raw template is not serialised by the driver.
  const rows = await executeRows<{ day: string; total: number | string }>(
    db,
    raw`
      select to_char(date_trunc('day', ${calls.startedAt}), 'YYYY-MM-DD') as day,
             count(*)::int as total
      from ${calls}
      where ${calls.startedAt} >= date_trunc('day', now()) - make_interval(days => ${days - 1})
        ${ids ? raw`and ${inArray(calls.calledById, ids)}` : raw``}
      group by 1
      order by 1
    `,
  );

  const counts = new Map(rows.map((row) => [row.day, Number(row.total)]));

  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(from);
    date.setDate(date.getDate() + offset);
    const day = date.toISOString().slice(0, 10);
    return { day, total: counts.get(day) ?? 0 };
  });
}
