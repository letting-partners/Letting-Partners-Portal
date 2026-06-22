import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import {
  formatCurrency,
  formatPKR,
  gbpToPkr,
  pkrToGbp,
  AGENT_COMMISSION_PKR,
} from "@/lib/format";
import { SalesFilterBar } from "@/components/sales-filter-bar";
import { formatPeriodRange, isPeriodKey, parsePeriodToDateRange, type PeriodKey } from "@/lib/period";
import { SalesClient } from "./sales-client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
  };
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session) return null;

  const requestedPeriod = firstQueryValue(searchParams?.period);
  const period: PeriodKey = isPeriodKey(requestedPeriod) ? requestedPeriod : "month";
  const from = firstQueryValue(searchParams?.from);
  const to = firstQueryValue(searchParams?.to);
  const salesRange = parsePeriodToDateRange(period, from, to);
  const salesRangeLabel = formatPeriodRange(salesRange);

  const where: Prisma.SaleWhereInput = { property: { ownerAgentId: session.userId } };
  if (salesRange) {
    where.closedAt = salesRange;
  }

  const [agg, sales] = await Promise.all([
    db.sale.aggregate({
      where,
      _sum: { finalAmount: true, commissionAmount: true, profit: true },
      _count: { id: true },
    }),
    db.sale.findMany({
      where,
      orderBy: [{ closedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        finalAmount: true,
        commissionAmount: true,
        profit: true,
        closedAt: true,
        property: {
          select: {
            id: true,
            propertyRef: true,
            addressLine1: true,
            city: true,
            postcode: true,
            landlord: { select: { id: true, landlordName: true } },
          },
        },
        tenant: {
          select: { id: true, fullName: true },
        },
      },
    }),
  ]);

  const totalRevenue = Number(agg._sum.finalAmount ?? 0);
  const totalCommission = Number(agg._sum.commissionAmount ?? 0);
  const totalProfit = Number(agg._sum.profit ?? 0);
  const totalSales = agg._count.id;
  const myCommissionPKR = totalSales * AGENT_COMMISSION_PKR;
  const myCommissionGBP = pkrToGbp(myCommissionPKR);

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">My Sales</h1>
          <p className="page-subtitle">Closed sales for {salesRangeLabel}.</p>
        </div>
      </header>

      <div className="panel" style={{ padding: "1rem 1.1rem" }}>
        <SalesFilterBar period={period} from={from} to={to} rangeLabel={salesRangeLabel} salesCount={totalSales} />
      </div>

      <div className="agent-stats-grid-2">
        <div className="stat-card">
          <p className="stat-label">Sales Closed</p>
          <p className="stat-value">{totalSales}</p>
          <p className="stat-sub">{salesRangeLabel}</p>
        </div>
        <div className="stat-card stat-card-money">
          <p className="stat-label">My Commission Earned</p>
          <p className="stat-value" style={{ fontSize: "1.5rem", color: "var(--brand-gold)" }}>
            {formatPKR(myCommissionPKR)}
          </p>
          <p className="stat-pkr-sub">
            ~ {formatCurrency(myCommissionGBP)} - PKR {AGENT_COMMISSION_PKR.toLocaleString("en-US")}/sale
          </p>
        </div>
      </div>

      {totalSales > 0 ? (
        <div className="grid-cards">
          <div className="stat-card stat-card-money">
            <p className="stat-label">Total Revenue</p>
            <p className="stat-value stat-value-money" style={{ fontSize: "1.5rem" }}>
              {formatCurrency(totalRevenue)}
            </p>
            <p className="stat-pkr-sub">{formatPKR(gbpToPkr(totalRevenue))}</p>
          </div>
          <div className="stat-card stat-card-money">
            <p className="stat-label">Company Commission</p>
            <p className="stat-value stat-value-money" style={{ fontSize: "1.5rem" }}>
              {formatCurrency(totalCommission)}
            </p>
            <p className="stat-pkr-sub">{formatPKR(gbpToPkr(totalCommission))}</p>
          </div>
          <div className="stat-card stat-card-profit">
            <p className="stat-label">Net Profit</p>
            <p className="stat-value stat-value-profit" style={{ fontSize: "1.5rem" }}>
              {formatCurrency(totalProfit)}
            </p>
            <p className="stat-pkr-sub">{formatPKR(gbpToPkr(totalProfit))}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Avg Sale Value</p>
            <p className="stat-value" style={{ fontSize: "1.5rem" }}>
              {formatCurrency(Math.round(totalRevenue / totalSales))}
            </p>
            <p className="stat-pkr-sub">{formatPKR(gbpToPkr(Math.round(totalRevenue / totalSales)))}</p>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
            Sales Breakdown
          </h2>
        </div>
        {sales.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            No closed sales for this period.
          </div>
        ) : (
          <SalesClient
            sales={sales.map((sale) => ({
              ...sale,
              finalAmount: Number(sale.finalAmount),
              commissionAmount: Number(sale.commissionAmount),
              profit: Number(sale.profit),
            }))}
          />
        )}
      </div>
    </div>
  );
}
