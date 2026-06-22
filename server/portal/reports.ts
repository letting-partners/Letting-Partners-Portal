import { db } from "@/server/db";

type DbClient = typeof db & Record<string, any>;
const prisma = db as DbClient;

export type DailyReportSummary = {
  agentId: string;
  agentDisplayName?: string | null;
  reportDate: string;
  callsMade: number;
  callsConnected: number;
  callsFailed: number;
  landlordConfirm: number;
  viewingsArranged: number;
  successfulViewings: number;
  followUp: number;
  reSchedule: number;
  confirmedCalls: number;
  followUpCalls: number;
  notInterestedCalls: number;
  lookupEvents: number;
  propertiesCreated: number;
  tenantsCreated: number;
  workflowSummary?: Record<string, unknown> | null;
  notes?: string | null;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function summaryForAgent(agentId: string, date: Date): Promise<DailyReportSummary> {
  const start = startOfUtcDay(date);
  const end = endOfUtcDay(date);

  const [agent, totalCalls, confirmedCalls, followUpCalls, notInterestedCalls, lookups, propertiesCreated, tenantsCreated, salesClosed, followUpLeads] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: agentId },
        select: { id: true, agentDisplayName: true },
      }),
      prisma.callRecord.count({ where: { agentId, createdAt: { gte: start, lte: end } } }),
      prisma.callRecord.count({
        where: { agentId, createdAt: { gte: start, lte: end }, outcome: "CONFIRMED" },
      }),
      prisma.callRecord.count({
        where: { agentId, createdAt: { gte: start, lte: end }, outcome: "FOLLOW_UP" },
      }),
      prisma.callRecord.count({
        where: { agentId, createdAt: { gte: start, lte: end }, outcome: "NOT_INTERESTED" },
      }),
      prisma.landlordLookupEvent.count({ where: { agentId, createdAt: { gte: start, lte: end } } }),
      prisma.property.count({ where: { ownerAgentId: agentId, createdAt: { gte: start, lte: end } } }),
      prisma.tenant.count({ where: { addedByAgentId: agentId, createdAt: { gte: start, lte: end } } }),
      prisma.sale.count({ where: { closedByUserId: agentId, closedAt: { gte: start, lte: end } } }),
      prisma.potentialLandlord.count({ where: { addedByAgentId: agentId, createdAt: { gte: start, lte: end } } }),
    ]);

  const workflowSummary = {
    confirmedCalls,
    followUpCalls,
    notInterestedCalls,
    lookups,
    propertiesCreated,
    tenantsCreated,
    followUpLeads,
    salesClosed,
  };

  const dbPayload = {
    agentId,
    reportDate: start,
    callsMade: totalCalls,
    callsConnected: confirmedCalls,
    callsFailed: notInterestedCalls,
    landlordConfirm: confirmedCalls,
    viewingsArranged: propertiesCreated,
    successfulViewings: salesClosed,
    followUp: followUpCalls,
    reSchedule: 0,
    confirmedCalls,
    followUpCalls,
    notInterestedCalls,
    lookupEvents: lookups,
    propertiesCreated,
    tenantsCreated,
    workflowSummary,
  };

  await prisma.dailyReport.upsert({
    where: {
      agentId_reportDate: {
        agentId,
        reportDate: start,
      },
    },
    create: dbPayload as any,
    update: {
      callsMade: totalCalls,
      callsConnected: confirmedCalls,
      callsFailed: notInterestedCalls,
      landlordConfirm: confirmedCalls,
      viewingsArranged: propertiesCreated,
      successfulViewings: salesClosed,
      followUp: followUpCalls,
      reSchedule: 0,
      confirmedCalls,
      followUpCalls,
      notInterestedCalls,
      lookupEvents: lookups,
      propertiesCreated,
      tenantsCreated,
      workflowSummary,
      notes: null,
    } as any,
  });

  const existing = await prisma.dailyReport.findUnique({
    where: {
      agentId_reportDate: {
        agentId,
        reportDate: start,
      },
    },
  });

  return {
    agentId,
    agentDisplayName: agent?.agentDisplayName ?? null,
    reportDate: dateKey(start),
    callsMade: Number((existing as any)?.callsMade ?? totalCalls),
    callsConnected: Number((existing as any)?.callsConnected ?? confirmedCalls),
    callsFailed: Number((existing as any)?.callsFailed ?? notInterestedCalls),
    landlordConfirm: Number((existing as any)?.landlordConfirm ?? confirmedCalls),
    viewingsArranged: Number((existing as any)?.viewingsArranged ?? propertiesCreated),
    successfulViewings: Number((existing as any)?.successfulViewings ?? salesClosed),
    followUp: Number((existing as any)?.followUp ?? followUpCalls),
    reSchedule: Number((existing as any)?.reSchedule ?? 0),
    confirmedCalls: Number((existing as any)?.confirmedCalls ?? confirmedCalls),
    followUpCalls: Number((existing as any)?.followUpCalls ?? followUpCalls),
    notInterestedCalls: Number((existing as any)?.notInterestedCalls ?? notInterestedCalls),
    lookupEvents: Number((existing as any)?.lookupEvents ?? lookups),
    propertiesCreated: Number((existing as any)?.propertiesCreated ?? propertiesCreated),
    tenantsCreated: Number((existing as any)?.tenantsCreated ?? tenantsCreated),
    workflowSummary: (existing as any)?.workflowSummary ?? workflowSummary,
    notes: (existing as any)?.notes ?? null,
  };
}

export async function buildDailyReportForAgent(agentId: string, date: Date = new Date()) {
  return summaryForAgent(agentId, date);
}

export async function buildDailyReportsForRange(params: {
  agentIds: string[];
  startDate: Date;
  endDate: Date;
}) {
  const start = startOfUtcDay(params.startDate);
  const end = startOfUtcDay(params.endDate);
  const summaries: DailyReportSummary[] = [];

  for (const agentId of params.agentIds) {
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      summaries.push(await summaryForAgent(agentId, cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return summaries;
}

export async function listDailyReportsForRole(params: {
  role: "ADMIN" | "AGENT";
  userId: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const startDate = params.startDate ?? new Date();
  const endDate = params.endDate ?? startDate;

  if (params.role === "AGENT") {
    return buildDailyReportsForRange({
      agentIds: [params.userId],
      startDate,
      endDate,
    });
  }

  const agents = await prisma.user.findMany({
    where: { role: "AGENT", isActive: true },
    select: { id: true },
    orderBy: { agentDisplayName: "asc" },
  });

  return buildDailyReportsForRange({
    agentIds: agents.map((agent: { id: string }) => agent.id),
    startDate,
    endDate,
  });
}
