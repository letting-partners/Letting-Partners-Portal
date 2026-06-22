import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole, PropertyStatus } from "@prisma/client";
import { db } from "@/server/db";
import { formatDate, formatDateTime, formatCurrency, formatPKR, gbpToPkr, GBP_TO_PKR } from "@/lib/format";
import { calcAgentCommissionGBP, describeCommission, type CommissionConfigData, type FlexibleRange } from "@/lib/commission";
import { getAuthSession } from "@/server/auth";
import { PropertyPreviewCard } from "@/components/property-preview-card";
import { SalesFilterBar } from "@/components/sales-filter-bar";
import { formatPeriodRange, isPeriodKey, parsePeriodToDateRange, type PeriodKey } from "@/lib/period";
import { serializePropertyImageList } from "@/server/property-media";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
    postcode?: string | string[];
  };
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const requestedPeriod = firstQueryValue(searchParams?.period);
  const period: PeriodKey = isPeriodKey(requestedPeriod) ? requestedPeriod : "month";
  const from = firstQueryValue(searchParams?.from);
  const to = firstQueryValue(searchParams?.to);
  const postcode = firstQueryValue(searchParams?.postcode)?.trim();
  const salesRange = parsePeriodToDateRange(period, from, to);
  const salesRangeLabel = formatPeriodRange(salesRange);

  const saleWhere = salesRange
    ? { closedAt: { gte: salesRange.gte, lte: salesRange.lte } }
    : {};

  const [
    agentCount,
    activeAgentCount,
    landlordCount,
    activeLandlordCount,
    propertyCount,
    salesAgg,
    tenantCount,
    propByStatus,
    agentPerformanceRaw,
    recentSales,
    recentAgents,
    recentAudit,
    commissionRaw,
    postcodeMatches,
  ] = await Promise.all([
    db.user.count({ where: { role: UserRole.AGENT } }),
    db.user.count({ where: { role: UserRole.AGENT, isActive: true } }),
    db.landlord.count(),
    db.landlord.count({ where: { properties: { some: {} } } }),
    db.property.count(),
    db.sale.aggregate({
      where: saleWhere,
      _sum: { finalAmount: true, commissionAmount: true, profit: true },
      _count: { id: true },
    }),
    db.tenant.count(),
    db.property.groupBy({ by: ["status"], _count: { id: true } }),
    db.user.findMany({
      where: { role: UserRole.AGENT },
      select: {
        id: true,
        agentDisplayName: true,
        email: true,
        isActive: true,
        createdAt: true,
        _count: { select: { ownedLandlords: true, ownedProperties: true } },
        ownedProperties: {
          select: {
            sales: {
              where: salesRange ? { closedAt: { gte: salesRange.gte, lte: salesRange.lte } } : undefined,
              select: {
                commissionAmount: true,
                finalAmount: true,
                tenant: { select: { id: true } },
              },
            },
          },
        },
      },
    }),
    db.sale.findMany({
      where: saleWhere,
      orderBy: { closedAt: "desc" },
      take: 6,
      select: {
        id: true,
        finalAmount: true,
        commissionAmount: true,
        profit: true,
        closedAt: true,
        closedBy: { select: { agentDisplayName: true } },
        property: {
          select: {
            propertyRef: true,
            addressLine1: true,
            city: true,
            landlord: { select: { id: true, landlordName: true } },
          },
        },
      },
    }),
    db.user.findMany({
      where: { role: UserRole.AGENT },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        email: true,
        agentDisplayName: true,
        isActive: true,
        createdAt: true,
        _count: { select: { ownedLandlords: true, ownedProperties: true } },
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        entityType: true,
        action: true,
        createdAt: true,
        user: { select: { agentDisplayName: true, email: true } },
      },
    }),
    db.commissionConfig.findUnique({ where: { id: "singleton" } }),
    postcode
      ? db.property.findMany({
          where: {
            postcode: { contains: postcode, mode: "insensitive" as const },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
          select: {
            id: true,
            propertyRef: true,
            title: true,
            description: true,
            addressLine1: true,
            city: true,
            postcode: true,
            propertyType: true,
            beds: true,
            baths: true,
            status: true,
            vacancyType: true,
            landlord: { select: { id: true, landlordName: true } },
            ownerAgent: { select: { id: true, agentDisplayName: true } },
            mediaLinks: {
              orderBy: [{ sortOrder: "asc" }, { mediaAssetId: "asc" }],
              select: {
                mediaAsset: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const postcodePropertyCards = serializePropertyImageList(postcodeMatches);

  const commissionConfig: CommissionConfigData = commissionRaw
    ? {
        type: commissionRaw.type as "FIXED" | "FLEXIBLE",
        fixedAmount: commissionRaw.fixedAmount ? Number(commissionRaw.fixedAmount) : null,
        fixedCurrency: commissionRaw.fixedCurrency as CommissionConfigData["fixedCurrency"],
        flexibleRanges: commissionRaw.flexibleRanges as FlexibleRange[] | null,
      }
    : { type: "FIXED", fixedAmount: 5000, fixedCurrency: "PKR", flexibleRanges: null };

  const inactiveAgents  = agentCount - activeAgentCount;
  const totalRevenue    = Number(salesAgg._sum.finalAmount      ?? 0);
  const totalCommission = Number(salesAgg._sum.commissionAmount ?? 0);
  const totalProfit     = Number(salesAgg._sum.profit           ?? 0);
  const totalSales      = salesAgg._count.id;
  const avgSaleValue    = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;
  const commissionDesc  = describeCommission(commissionConfig);

  const statusMap: Partial<Record<PropertyStatus, number>> = {};
  for (const g of propByStatus) statusMap[g.status] = g._count.id;

  const agentPerformance = agentPerformanceRaw
    .map((agent) => {
      const sales = agent.ownedProperties.flatMap((property) => property.sales);
      const totalCommission = sales.reduce((sum, sale) => sum + Number(sale.commissionAmount ?? 0), 0);
      const totalAgentCommGBP = sales.reduce(
        (sum, sale) => sum + calcAgentCommissionGBP(Number(sale.commissionAmount ?? 0), commissionConfig),
        0
      );
      return {
        ...agent,
        salesCount: sales.length,
        tenantsCount: sales.filter((sale) => sale.tenant != null).length,
        totalRevenue: sales.reduce((sum, sale) => sum + Number(sale.finalAmount ?? 0), 0),
        totalCommission,
        totalAgentCommGBP,
      };
    })
    .sort((a, b) => b.salesCount - a.salesCount || b._count.ownedLandlords - a._count.ownedLandlords)
    .slice(0, 8);

  return (
    <div className="stack">

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Platform overview — agents, landlords, properties, sales &amp; revenue.</p>
        </div>
        <div className="inline-row">
          <Link className="admin-action-btn admin-action-btn-primary" href="/admin/agents">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2.046 15.253c-.058.468.172.92.57 1.175A9.953 9.953 0 0 0 8 18c1.982 0 3.83-.574 5.384-1.572.398-.254.628-.707.57-1.175a6.001 6.001 0 0 0-11.908 0ZM12.75 7.75a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5ZM12 10.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75ZM12.75 13.25a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5Z" />
            </svg>
            Add Agent
          </Link>
          <Link className="admin-action-btn admin-action-btn-secondary" href="/admin/audit">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5L9 4H4Z" clipRule="evenodd" />
            </svg>
            Audit Logs
          </Link>
        </div>
      </header>

      {/* ── ROW 1: 2 hero cards — Sales Closed + Commission Earned ──────── */}
      <div className="panel" style={{ padding: "1rem 1.1rem" }}>
        <SalesFilterBar period={period} from={from} to={to} rangeLabel={salesRangeLabel} salesCount={totalSales} />
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Search Properties by Postcode</h2>
        </div>
        <div className="admin-card-body">
          <form method="get" className="stack" style={{ gap: "0.75rem" }}>
            <input type="hidden" name="period" value={period} />
            {from ? <input type="hidden" name="from" value={from} /> : null}
            {to ? <input type="hidden" name="to" value={to} /> : null}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <label className="field" style={{ flex: "1 1 320px", marginBottom: 0 }}>
                <span className="label">Postcode</span>
                <input className="input" name="postcode" defaultValue={postcode ?? ""} placeholder="Enter postcode" />
              </label>
              <button type="submit" className="btn btn-primary">Search</button>
              {postcode ? (
                <Link href="/admin" className="btn btn-secondary">
                  Clear
                </Link>
              ) : null}
            </div>
          </form>

          {postcode ? (
            <div style={{ marginTop: "1rem" }}>
              {postcodePropertyCards.length > 0 ? (
                <div className="property-card-grid">
                  {postcodePropertyCards.map((property) => (
                    <PropertyPreviewCard
                      key={property.id}
                      href={`/admin/properties/${property.id}`}
                      property={property}
                      landlord={{
                        label: "Landlord",
                        name: property.landlord.landlordName,
                        href: `/landlords/${property.landlord.id}`,
                      }}
                      agent={{
                        label: "Agent",
                        name: property.ownerAgent.agentDisplayName,
                        href: `/admin/agents/${property.ownerAgent.id}`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  No properties found for that postcode.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <p className="section-label">Sales Overview</p>
        <div className="admin-stats-grid-2">

          <Link href="/admin/sales" className="admin-stat-card admin-stat-card-hero">
            <div className="admin-stat-card-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="admin-stat-label">Sales Closed</p>
            <p className="admin-stat-value admin-stat-value-hero">{totalSales}</p>
            <p className="admin-stat-sub">{salesRangeLabel}</p>
          </Link>

          <Link href="/admin/sales" className="admin-stat-card admin-stat-card-hero" style={{ borderTopColor: "var(--brand-gold)" }}>
            <div className="admin-stat-card-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.798 7.45c.512-.67 1.135-.95 1.702-.95s1.19.28 1.702.95a.75.75 0 0 0 1.192-.91C12.637 5.55 11.596 5 10.5 5s-2.137.55-2.894 1.54A5.205 5.205 0 0 0 6.5 10c0 1.173.382 2.26 1.106 3.46C8.363 14.45 9.404 15 10.5 15s2.137-.55 2.894-1.54a.75.75 0 0 0-1.192-.91c-.512.67-1.135.95-1.702.95s-1.19-.28-1.702-.95A3.705 3.705 0 0 1 8 10c0-.87.284-1.72.798-2.55Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="admin-stat-label">Commission Earned</p>
            <p className="admin-stat-value admin-stat-value-hero" style={{ color: "var(--brand-gold)" }}>
              {formatCurrency(totalCommission)}
            </p>
            <p className="admin-stat-pkr">≈ {formatPKR(gbpToPkr(totalCommission))}</p>
            <p className="admin-stat-sub">
              {totalRevenue > 0
                ? `${((totalCommission / totalRevenue) * 100).toFixed(1)}% avg commission rate`
                : "No sales yet"}
            </p>
          </Link>
        </div>
      </div>

      {/* ── ROW 2: 4 financial cards ──────────────────────────────────────── */}
      <div>
        <p className="section-label">Financial Breakdown</p>
        <div className="admin-stats-grid-wide">

          <Link href="/admin/sales" className="admin-stat-card" style={{ borderTopColor: "var(--success)" }}>
            <div className="admin-stat-card-icon" style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.25)" }}>
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ color: "#4ade80" }}>
                <path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 0 0-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.615Z" />
                <path fillRule="evenodd" d="M9.99 2.17a8 8 0 1 0 .02 15.94A8 8 0 0 0 9.99 2.17ZM10 4a6 6 0 1 1 0 12A6 6 0 0 1 10 4ZM9.25 6.75a.75.75 0 0 1 1.5 0V7h.25a2.25 2.25 0 0 1 2.25 2.25c0 .666-.327 1.22-.812 1.58.485.36.812.914.812 1.58A2.25 2.25 0 0 1 11 14.75h-.25v.5a.75.75 0 0 1-1.5 0v-.5H9a2.25 2.25 0 0 1-2.25-2.25.75.75 0 0 1 1.5 0c0 .414.336.75.75.75h.25v-2.364a3.386 3.386 0 0 1-1.306-.73C7.41 9.9 7 9.247 7 8.5A2.25 2.25 0 0 1 9.25 6.25V6.75Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="admin-stat-label">Total Revenue</p>
            <p className="admin-stat-value" style={{ color: "#4ade80", fontSize: "1.8rem" }}>
              {formatCurrency(totalRevenue)}
            </p>
            <p className="admin-stat-pkr">≈ {formatPKR(gbpToPkr(totalRevenue))}</p>
            <p className="admin-stat-sub">Combined final sale amounts</p>
          </Link>

          <Link href="/admin/sales" className="admin-stat-card" style={{ borderTopColor: "#06b6d4" }}>
            <div className="admin-stat-card-icon" style={{ background: "rgba(6,182,212,0.1)", borderColor: "rgba(6,182,212,0.25)" }}>
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ color: "#22d3ee" }}>
                <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 0 1 .919-.53l4.78 1.281a.75.75 0 0 1 .531.919l-1.281 4.78a.75.75 0 0 1-1.449-.387l.81-3.022a19.407 19.407 0 0 0-5.594 5.203.75.75 0 0 1-1.139.093L7 10.06l-4.72 4.72a.75.75 0 0 1-1.06-1.061l5.25-5.25a.75.75 0 0 1 1.06 0l3.074 3.073a20.923 20.923 0 0 1 5.545-4.931l-3.042-.815a.75.75 0 0 1-.53-.918Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="admin-stat-label">Net Profit</p>
            <p className="admin-stat-value" style={{ color: "#22d3ee", fontSize: "1.8rem" }}>
              {formatCurrency(totalProfit)}
            </p>
            <p className="admin-stat-pkr">≈ {formatPKR(gbpToPkr(totalProfit))}</p>
            <p className="admin-stat-sub">After all costs deducted</p>
          </Link>

          <Link href="/admin/sales" className="admin-stat-card">
            <div className="admin-stat-card-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.632l2.051-.684a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684Z" />
              </svg>
            </div>
            <p className="admin-stat-label">Avg Sale Value</p>
            <p className="admin-stat-value" style={{ fontSize: "1.8rem" }}>
              {totalSales > 0 ? formatCurrency(avgSaleValue) : "—"}
            </p>
            {totalSales > 0 && <p className="admin-stat-pkr">≈ {formatPKR(gbpToPkr(avgSaleValue))}</p>}
            <p className="admin-stat-sub">Per closed sale</p>
          </Link>

          <div className="admin-stat-card" style={{ borderTopColor: "#a78bfa" }}>
            <div className="admin-stat-card-icon" style={{ background: "rgba(167,139,250,0.1)", borderColor: "rgba(167,139,250,0.25)" }}>
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ color: "#a78bfa" }}>
                <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
              </svg>
            </div>
            <p className="admin-stat-label">Agent Commissions</p>
            {(() => {
              // Sum agent commissions across recent sales data for display
              // We use the aggregated sum from all sales via recentSales; for the full total we'd need all sales
              // Display the formula description instead
              return (
                <>
                  <p className="admin-stat-value" style={{ color: "#a78bfa", fontSize: "1.8rem" }}>
                    {totalSales > 0 ? formatCurrency(
                      agentPerformanceRaw
                        .flatMap((a) => a.ownedProperties.flatMap((p) => p.sales))
                        .reduce((sum, s) => sum + calcAgentCommissionGBP(Number(s.commissionAmount ?? 0), commissionConfig), 0)
                    ) : "—"}
                  </p>
                  <p className="admin-stat-sub">{commissionDesc}</p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── ROW 3: 4 count cards ──────────────────────────────────────────── */}
      <div>
        <p className="section-label">Platform Totals</p>
        <div className="admin-stats-grid-wide">

          <Link href="/admin/agents" className="admin-stat-card">
            <div className="admin-stat-card-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
              </svg>
            </div>
            <p className="admin-stat-label">Total Agents</p>
            <p className="admin-stat-value">{agentCount}</p>
            <p className="admin-stat-sub">{activeAgentCount} active · {inactiveAgents} disabled</p>
          </Link>

          <Link href="/admin/landlords" className="admin-stat-card">
            <div className="admin-stat-card-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="admin-stat-label">Total Landlords</p>
            <p className="admin-stat-value">{landlordCount}</p>
            <p className="admin-stat-sub">{activeLandlordCount} active in registry</p>
          </Link>

          <Link href="/admin/properties" className="admin-stat-card">
            <div className="admin-stat-card-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v11a3 3 0 1 0 6 0V4a2 2 0 0 0-2-2H4Zm1 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5-1.757 4.9-4.9a2 2 0 0 0 0-2.828L13.485 5.1a2 2 0 0 0-2.828 0L10 5.757v8.486ZM16 17H9.071l6-6H16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="admin-stat-label">Total Properties</p>
            <p className="admin-stat-value">{propertyCount}</p>
            <p className="admin-stat-sub">
              {statusMap.AVAILABLE ?? 0} available · {statusMap.DRAFT ?? 0} draft
            </p>
          </Link>

          <Link href="/admin/tenants" className="admin-stat-card">
            <div className="admin-stat-card-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
              </svg>
            </div>
            <p className="admin-stat-label">Total Tenants</p>
            <p className="admin-stat-value">{tenantCount}</p>
            <p className="admin-stat-sub">Tenant records on file</p>
          </Link>
        </div>
      </div>

      {/* ── Properties by Status ──────────────────────────────────────────── */}
      {propertyCount > 0 && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v11a3 3 0 1 0 6 0V4a2 2 0 0 0-2-2H4Zm1 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5-1.757 4.9-4.9a2 2 0 0 0 0-2.828L13.485 5.1a2 2 0 0 0-2.828 0L10 5.757v8.486ZM16 17H9.071l6-6H16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Z" clipRule="evenodd" />
              </svg>
              Properties by Status
            </h2>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{propertyCount} total</span>
          </div>
          <div className="admin-card-body" style={{ paddingBottom: "1.25rem" }}>
            <div className="status-breakdown">
              {(
                [
                  ["AVAILABLE", "Available", "status-item-live" ],
                  ["DRAFT",     "Draft",     "status-item-draft"],
                  ["CLOSED",    "Closed",    "status-item-sold" ],
                ] as [PropertyStatus, string, string][]
              ).map(([status, label, cls]) => (
                <div key={status} className={`status-item ${cls}`}>
                  <p className="status-item-count">{statusMap[status] ?? 0}</p>
                  <p className="status-item-label">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Agent Performance + Recent Sales ──────────────────────────────── */}
      <div className="two-col">

        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
              </svg>
              Agent Performance
            </h2>
            <Link className="btn btn-sm btn-secondary" href="/admin/agents">Manage Agents</Link>
          </div>
          <div style={{ padding: 0 }}>
            {agentPerformance.length === 0 ? (
              <div className="admin-card-body">
                <p className="muted" style={{ margin: 0, textAlign: "center" }}>No agents yet.</p>
              </div>
            ) : (
              <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Sales</th>
                      <th>Co. Commission</th>
                      <th>Agent Comm.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPerformance.map((agent, idx) => (
                      <tr key={agent.id} className={idx === 0 && agent.salesCount > 0 ? "perf-rank-1" : ""}>
                        <td>
                          <strong style={{ display: "block" }}>
                            {agent.agentDisplayName}
                            {idx === 0 && agent.salesCount > 0 && (
                              <span style={{ marginLeft: "0.4rem", fontSize: "0.65rem", color: "var(--brand-gold)" }}>★</span>
                            )}
                          </strong>
                          <span className="muted" style={{ fontSize: "0.75rem" }}>{agent.email}</span>
                          {!agent.isActive && (
                            <span className="badge badge-locked" style={{ marginTop: "0.2rem", display: "inline-flex" }}>Disabled</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: agent.salesCount > 0 ? "#4ade80" : "var(--text-subtle)" }}>
                          {agent.salesCount}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: agent.totalCommission > 0 ? "var(--brand-gold)" : "var(--text-subtle)" }}>
                            {agent.totalCommission > 0 ? formatCurrency(agent.totalCommission) : "—"}
                          </span>
                          {agent.totalCommission > 0 && (
                            <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              ≈ {formatPKR(gbpToPkr(agent.totalCommission))}
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: agent.salesCount > 0 ? "#a78bfa" : "var(--text-subtle)" }}>
                            {agent.salesCount > 0 ? formatCurrency(agent.totalAgentCommGBP) : "—"}
                          </span>
                          {agent.salesCount > 0 && (
                            <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              ≈ {formatPKR(agent.totalAgentCommGBP * GBP_TO_PKR)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              Recent Sales
            </h2>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{totalSales} total</span>
          </div>
          <div style={{ padding: 0 }}>
            {recentSales.length === 0 ? (
              <div className="admin-card-body">
                <p className="muted" style={{ margin: 0, textAlign: "center" }}>No sales closed yet.</p>
              </div>
            ) : (
              <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Amount</th>
                      <th>Commission</th>
                      <th>Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale) => (
                      <tr key={sale.id}>
                        <td>
                          <span style={{ fontWeight: 600, display: "block", color: "var(--text)" }}>
                            {sale.property.addressLine1}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {sale.property.city}{sale.closedBy ? ` · ${sale.closedBy.agentDisplayName}` : ""}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: "#4ade80" }}>
                            {formatCurrency(Number(sale.finalAmount))}
                          </span>
                          <span style={{ display: "block", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            ≈ {formatPKR(gbpToPkr(Number(sale.finalAmount)))}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: "var(--brand-gold)" }}>
                            {formatCurrency(Number(sale.commissionAmount))}
                          </span>
                          <span style={{ display: "block", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            ≈ {formatPKR(gbpToPkr(Number(sale.commissionAmount)))}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {formatDate(sale.closedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Agents + Recent Activity ───────────────────────────────── */}
      <div className="two-col">

        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
              </svg>
              Recently Added Agents
            </h2>
            <Link className="btn btn-sm btn-secondary" href="/admin/agents">View All</Link>
          </div>
          <div style={{ padding: 0 }}>
            {recentAgents.length === 0 ? (
              <div className="admin-card-body">
                <p className="muted" style={{ margin: 0, textAlign: "center" }}>No agents yet.</p>
              </div>
            ) : (
              <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Status</th>
                      <th>Landlords</th>
                      <th>Properties</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAgents.map((agent) => (
                      <tr key={agent.id}>
                        <td>
                          <strong style={{ display: "block" }}>{agent.agentDisplayName}</strong>
                          <span className="muted" style={{ fontSize: "0.75rem" }}>{agent.email}</span>
                        </td>
                        <td>
                          <span className={`badge ${agent.isActive ? "badge-active" : "badge-locked"}`}>
                            {agent.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="gold">{agent._count.ownedLandlords}</td>
                        <td style={{ color: "var(--text-muted)" }}>{agent._count.ownedProperties}</td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {formatDate(agent.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5L9 4H4Z" clipRule="evenodd" />
              </svg>
              Recent Activity
            </h2>
            <Link className="btn btn-sm btn-secondary" href="/admin/audit">Full Log</Link>
          </div>
          <div style={{ padding: 0 }}>
            {recentAudit.length === 0 ? (
              <div className="admin-card-body">
                <p className="muted" style={{ margin: 0, textAlign: "center" }}>No audit records yet.</p>
              </div>
            ) : (
              <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>By</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAudit.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color:
                              log.action.includes("CREATE") ? "var(--success)" :
                              log.action.includes("DELETE") || log.action.includes("REMOVE") ? "var(--danger)" :
                              log.action.includes("STATUS") ? "var(--warning)" :
                              "var(--brand-gold)",
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{log.entityType}</td>
                        <td style={{ fontSize: "0.8rem" }}>{log.user.agentDisplayName ?? log.user.email}</td>
                        <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {formatDateTime(log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────────────── */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
            Quick Actions
          </h2>
        </div>
        <div className="admin-card-body">
          <div className="admin-quick-actions">
            <Link className="admin-action-btn admin-action-btn-primary" href="/admin/agents">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2.046 15.253c-.058.468.172.92.57 1.175A9.953 9.953 0 0 0 8 18c1.982 0 3.83-.574 5.384-1.572.398-.254.628-.707.57-1.175a6.001 6.001 0 0 0-11.908 0ZM12.75 7.75a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5ZM12 10.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75ZM12.75 13.25a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5Z" />
              </svg>
              Manage Agents
            </Link>
            <Link className="admin-action-btn admin-action-btn-secondary" href="/admin/audit">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5L9 4H4Z" clipRule="evenodd" />
              </svg>
              View Audit Logs
            </Link>
            <Link className="admin-action-btn admin-action-btn-secondary" href="/admin/landlords">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
              </svg>
              All Landlords
            </Link>
            <Link className="admin-action-btn admin-action-btn-secondary" href="/admin/properties">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v11a3 3 0 1 0 6 0V4a2 2 0 0 0-2-2H4Zm1 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5-1.757 4.9-4.9a2 2 0 0 0 0-2.828L13.485 5.1a2 2 0 0 0-2.828 0L10 5.757v8.486ZM16 17H9.071l6-6H16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Z" clipRule="evenodd" />
              </svg>
              All Properties
            </Link>
            <Link className="admin-action-btn admin-action-btn-secondary" href="/admin/sales">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              All Sales
            </Link>
            <Link className="admin-action-btn admin-action-btn-secondary" href="/admin/tenants">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
              </svg>
              All Tenants
            </Link>
            <Link className="admin-action-btn admin-action-btn-secondary" href="/dashboard">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2ZM2 9a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H2Z" />
              </svg>
              Agent Dashboard
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
