import "server-only";
import { and, count, desc, eq, gte, ilike, lte, or, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  commissions,
  deals,
  landlords,
  properties,
  propertyRooms,
  sales,
  tenants,
} from "@/db/schema";
import { ENTITY } from "./audit";
import { loadPeopleMap } from "./landlords";
import type { CommissionBreakdown } from "./commission-engine";
import {
  canViewCompanyFinancials,
  ForbiddenError,
  type AccessContext,
} from "./permissions";

/**
 * Completed sales and their commission.
 *
 * Nothing here recalculates anything. Every figure was frozen inside the
 * closing transaction, so a sale from last year still explains itself with the
 * rules that were live when it closed.
 */

export type SaleListFilters = {
  search?: string;
  from?: Date;
  to?: Date;
  agentId?: string;
  fronterId?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Which sales a user may see. Everyone sees the sales they earned from;
 * admins see all.
 */
function saleVisibility(context: AccessContext): SQL | undefined {
  if (context.isAdmin) return undefined;

  return or(
    eq(sales.propertyAgentId, context.user.id),
    eq(sales.tenantAgentId, context.user.id),
    eq(sales.originatingFronterId, context.user.id),
  );
}

export async function listSales(context: AccessContext, filters: SaleListFilters = {}) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);

  const conditions: (SQL | undefined)[] = [saleVisibility(context)];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(sales.reference, term),
        ilike(properties.formattedAddress, term),
        ilike(properties.reference, term),
        ilike(tenants.name, term),
        ilike(landlords.name, term),
      ),
    );
  }

  if (filters.from) conditions.push(gte(sales.closingDate, filters.from));
  if (filters.to) conditions.push(lte(sales.closingDate, filters.to));
  if (filters.agentId) {
    conditions.push(
      or(eq(sales.propertyAgentId, filters.agentId), eq(sales.tenantAgentId, filters.agentId)),
    );
  }
  if (filters.fronterId) conditions.push(eq(sales.originatingFronterId, filters.fronterId));

  const where = and(...conditions);

  const [rows, totalRows, totals] = await Promise.all([
    db
      .select({
        id: sales.id,
        reference: sales.reference,
        closingDate: sales.closingDate,
        status: sales.status,
        grossCommissionPence: sales.grossCommissionPence,
        fronterCommissionPence: sales.fronterCommissionPence,
        propertyAgentCommissionPence: sales.propertyAgentCommissionPence,
        tenantAgentCommissionPence: sales.tenantAgentCommissionPence,
        companyNetPence: sales.companyNetPence,
        propertyId: sales.propertyId,
        propertyReference: properties.reference,
        propertyAddress: properties.formattedAddress,
        propertyTitle: properties.title,
        roomName: propertyRooms.name,
        landlordId: sales.landlordId,
        landlordName: landlords.name,
        tenantId: sales.tenantId,
        tenantName: tenants.name,
        propertyAgentId: sales.propertyAgentId,
        tenantAgentId: sales.tenantAgentId,
        originatingFronterId: sales.originatingFronterId,
        collaborationId: sales.collaborationId,
      })
      .from(sales)
      .innerJoin(properties, eq(properties.id, sales.propertyId))
      .innerJoin(landlords, eq(landlords.id, sales.landlordId))
      .innerJoin(tenants, eq(tenants.id, sales.tenantId))
      .leftJoin(propertyRooms, eq(propertyRooms.id, sales.roomId))
      .where(where)
      .orderBy(desc(sales.closingDate))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ value: count() })
      .from(sales)
      .innerJoin(properties, eq(properties.id, sales.propertyId))
      .innerJoin(landlords, eq(landlords.id, sales.landlordId))
      .innerJoin(tenants, eq(tenants.id, sales.tenantId))
      .where(where),

    db
      .select({
        gross: sum(sales.grossCommissionPence),
        company: sum(sales.companyNetPence),
      })
      .from(sales)
      .innerJoin(properties, eq(properties.id, sales.propertyId))
      .innerJoin(landlords, eq(landlords.id, sales.landlordId))
      .innerJoin(tenants, eq(tenants.id, sales.tenantId))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(
    rows.flatMap((row) => [row.propertyAgentId, row.tenantAgentId, row.originatingFronterId]),
  );

  return {
    rows: rows.map((row) => ({
      ...row,
      propertyAgent: people.get(row.propertyAgentId) ?? null,
      tenantAgent: row.tenantAgentId ? (people.get(row.tenantAgentId) ?? null) : null,
      fronter: row.originatingFronterId ? (people.get(row.originatingFronterId) ?? null) : null,
      /** What this particular user earned on this sale. */
      myCommissionPence:
        (row.propertyAgentId === context.user.id ? row.propertyAgentCommissionPence : 0) +
        (row.tenantAgentId === context.user.id ? row.tenantAgentCommissionPence : 0) +
        (row.originatingFronterId === context.user.id ? row.fronterCommissionPence : 0),
    })),
    totals: {
      grossPence: Number(totals[0]?.gross ?? 0),
      companyPence: Number(totals[0]?.company ?? 0),
    },
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getSale(id: string, context: AccessContext) {
  const rows = await db
    .select({
      sale: sales,
      property: properties,
      landlord: landlords,
      tenant: tenants,
      roomName: propertyRooms.name,
      dealStage: deals.stage,
    })
    .from(sales)
    .innerJoin(properties, eq(properties.id, sales.propertyId))
    .innerJoin(landlords, eq(landlords.id, sales.landlordId))
    .innerJoin(tenants, eq(tenants.id, sales.tenantId))
    .innerJoin(deals, eq(deals.id, sales.dealId))
    .leftJoin(propertyRooms, eq(propertyRooms.id, sales.roomId))
    .where(eq(sales.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const { sale } = row;

  const involved =
    sale.propertyAgentId === context.user.id ||
    sale.tenantAgentId === context.user.id ||
    sale.originatingFronterId === context.user.id;

  if (!context.isAdmin && !involved) throw new ForbiddenError();

  const [commissionRows, people] = await Promise.all([
    db
      .select()
      .from(commissions)
      .where(eq(commissions.saleId, id))
      .orderBy(commissions.beneficiary),

    loadPeopleMap([
      sale.propertyAgentId,
      sale.tenantAgentId,
      sale.originatingFronterId,
      sale.createdBy,
    ]),
  ]);

  // Only an administrator sees the company's retained portion.
  const showCompanyFigures = canViewCompanyFinancials(context);

  return {
    sale,
    property: row.property,
    landlord: row.landlord,
    tenant: row.tenant,
    roomName: row.roomName,
    breakdown: sale.calculationSnapshot as CommissionBreakdown,
    commissions: commissionRows
      .filter((commission) => showCompanyFigures || commission.beneficiary !== "COMPANY")
      .map((commission) => ({
        ...commission,
        beneficiaryName: commission.beneficiaryUserId
          ? (people.get(commission.beneficiaryUserId)?.fullName ?? "Unknown")
          : "Letting Partners",
        isMine: commission.beneficiaryUserId === context.user.id,
      })),
    propertyAgent: people.get(sale.propertyAgentId) ?? null,
    tenantAgent: sale.tenantAgentId ? (people.get(sale.tenantAgentId) ?? null) : null,
    fronter: sale.originatingFronterId
      ? (people.get(sale.originatingFronterId) ?? null)
      : null,
    creator: people.get(sale.createdBy) ?? null,
    showCompanyFigures,
  };
}

/** Everything one person has earned, for their profile and dashboard. */
export async function getCommissionSummary(userId: string) {
  const rows = await db
    .select({
      beneficiary: commissions.beneficiary,
      total: sum(commissions.amountPence),
      count: count(),
    })
    .from(commissions)
    .where(eq(commissions.beneficiaryUserId, userId))
    .groupBy(commissions.beneficiary);

  const byRole = new Map(rows.map((row) => [row.beneficiary, Number(row.total ?? 0)]));

  return {
    fronterPence: byRole.get("FRONTER") ?? 0,
    propertyAgentPence: byRole.get("PROPERTY_AGENT") ?? 0,
    tenantAgentPence: byRole.get("TENANT_AGENT") ?? 0,
    totalPence: rows.reduce((total, row) => total + Number(row.total ?? 0), 0),
    saleCount: rows.reduce((total, row) => total + Number(row.count ?? 0), 0),
  };
}

export { ENTITY };
