import Link from "next/link";
import { Prisma, UserRole, PropertyStatus } from "@prisma/client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { PropertyPreviewCard } from "@/components/property-preview-card";
import {
  formatDate,
  formatCurrency,
  formatPKR,
  gbpToPkr,
  pkrToGbp,
  AGENT_COMMISSION_PKR,
} from "@/lib/format";
import { SalesFilterBar } from "@/components/sales-filter-bar";
import { formatPeriodRange, isPeriodKey, parsePeriodToDateRange, type PeriodKey } from "@/lib/period";
import { serializePropertyImageList } from "@/server/property-media";
import { DashboardLookupWidget } from "@/components/dashboard-lookup-widget";

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

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session) return null;

  const isAdmin = session.role === UserRole.ADMIN;
  const requestedPeriod = firstQueryValue(searchParams?.period);
  const period: PeriodKey = isPeriodKey(requestedPeriod) ? requestedPeriod : "month";
  const from = firstQueryValue(searchParams?.from);
  const to = firstQueryValue(searchParams?.to);
  const postcode = firstQueryValue(searchParams?.postcode)?.trim();
  const salesRange = parsePeriodToDateRange(period, from, to);
  const salesRangeLabel = formatPeriodRange(salesRange);

  const landlordWhere: Prisma.LandlordWhereInput = isAdmin ? {} : { ownerAgentId: session.userId };
  const propertyWhere: Prisma.PropertyWhereInput = isAdmin ? {} : { ownerAgentId: session.userId };
  const saleWhere: Prisma.SaleWhereInput        = isAdmin ? {} : { property: { ownerAgentId: session.userId } };
  if (salesRange) {
    saleWhere.closedAt = salesRange;
  }
  const activeLandlordWhere: Prisma.LandlordWhereInput = {
    ...landlordWhere,
    properties: { some: {} },
  };

  const tenantWhere: Prisma.TenantWhereInput = isAdmin
    ? {}
    : { sale: { property: { ownerAgentId: session.userId } } };

  const [
    user,
    landlordsTotal,
    landlordsActive,
    propertiesTotal,
    agentsTotal,
    salesAgg,
    tenantsTotal,
    propByStatus,
    recentLandlords,
    recentProperties,
    recentSales,
    recentTenants,
    postcodeMatches,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { agentDisplayName: true },
    }),
    db.landlord.count({ where: landlordWhere }),
    db.landlord.count({ where: activeLandlordWhere }),
    db.property.count({ where: propertyWhere }),
    isAdmin ? db.user.count({ where: { role: "AGENT" } }) : Promise.resolve(0),
    db.sale.aggregate({
      where: saleWhere,
      _sum: { finalAmount: true, commissionAmount: true, profit: true },
      _count: { id: true },
    }),
    db.tenant.count({ where: tenantWhere }),
    db.property.groupBy({
      by: ["status"],
      where: propertyWhere,
      _count: { id: true },
    }),
    db.landlord.findMany({
      where: landlordWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        landlordName: true,
        landlordNumber: true,
        createdAt: true,
        ownerAgent: { select: { agentDisplayName: true } },
        _count: { select: { properties: true } },
      },
    }),
    db.property.findMany({
      where: propertyWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
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
        ownerAgent: { select: { agentDisplayName: true } },
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
    }),
    db.sale.findMany({
      where: saleWhere,
      orderBy: { closedAt: "desc" },
      take: 5,
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
    db.tenant.findMany({
      where: tenantWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        moveInDate: true,
        rentAmount: true,
        depositAmount: true,
        createdAt: true,
        sale: {
          select: {
            property: {
              select: {
                id: true,
                propertyRef: true,
                addressLine1: true,
                city: true,
                postcode: true,
                landlord: { select: { id: true, landlordName: true } },
                ownerAgent: { select: { agentDisplayName: true } },
              },
            },
          },
        },
      },
    }),
    postcode
      ? db.property.findMany({
          where: {
            ...propertyWhere,
            postcode: { contains: postcode },
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
                    dataUrl: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const recentPropertyCards = serializePropertyImageList(recentProperties);
  const postcodePropertyCards = serializePropertyImageList(postcodeMatches);

  const displayName    = user?.agentDisplayName ?? session.email;
  const landlordsPassive = landlordsTotal - landlordsActive;
  const totalRevenue     = Number(salesAgg._sum.finalAmount    ?? 0);
  const totalCommission  = Number(salesAgg._sum.commissionAmount ?? 0);
  const totalProfit      = Number(salesAgg._sum.profit          ?? 0);
  const totalSales       = salesAgg._count.id;

  // Agent personal commission: fixed PKR 5,000 per closed sale
  const myCommissionPKR = totalSales * AGENT_COMMISSION_PKR;
  const myCommissionGBP = pkrToGbp(myCommissionPKR);

  // Status map: { LIVE: 4, SOLD: 2, ... }
  const statusMap: Partial<Record<PropertyStatus, number>> = {};
  for (const g of propByStatus) statusMap[g.status] = g._count.id;

  const hasFinancials = totalSales > 0;

  const todayStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="stack">

      {/* ── Welcome Banner ─────────────────────────────────────────────── */}
      <div className="dashboard-welcome">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h1 className="dashboard-welcome-title">Welcome back, {displayName}</h1>
            <p className="dashboard-welcome-sub">
              {isAdmin
                ? "Platform-wide overview — all agents, landlords, properties and sales."
                : "Here's your complete portfolio summary for today."}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-subtle)", textAlign: "right", paddingTop: "0.2rem" }}>
            {todayStr}
          </p>
        </div>
      </div>

      {/* ── Landlord Phone Lookup (agents only) ────────────────────────── */}
      {!isAdmin && <DashboardLookupWidget />}

      {/* ── Portfolio Overview ──────────────────────────────────────────── */}
      <div className="panel" style={{ padding: "1rem 1.1rem" }}>
        <SalesFilterBar period={period} from={from} to={to} rangeLabel={salesRangeLabel} salesCount={totalSales} />
      </div>

      <div className="panel" style={{ padding: "1rem 1.1rem" }}>
        <form method="get" className="stack" style={{ gap: "0.75rem" }}>
          <input type="hidden" name="period" value={period} />
          {from ? <input type="hidden" name="from" value={from} /> : null}
          {to ? <input type="hidden" name="to" value={to} /> : null}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "1 1 320px", marginBottom: 0 }}>
              <span className="label">Search Properties by Postcode</span>
              <input className="input" name="postcode" defaultValue={postcode ?? ""} placeholder="Enter postcode" />
            </label>
            <button type="submit" className="btn btn-primary">Search</button>
            {postcode ? (
              <Link href="/dashboard" className="btn btn-secondary">
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
                    href={`/portal/properties/${property.id}`}
                    property={property}
                    landlord={{
                      label: "Landlord",
                      name: property.landlord.landlordName,
                      href: `/landlords/${property.landlord.id}`,
                    }}
                    agent={{
                      label: "Agent",
                      name: property.ownerAgent.agentDisplayName,
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

      <div>
        <p className="section-label">Portfolio Overview</p>
        <div className="grid-cards">
          <div className="stat-card">
            <p className="stat-label">My Landlords</p>
            <p className="stat-value">{landlordsTotal}</p>
            <p className="stat-sub">{landlordsActive} active · {landlordsPassive} passive</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">My Properties</p>
            <p className="stat-value">{propertiesTotal}</p>
            <p className="stat-sub">
              {statusMap.AVAILABLE ?? 0} available · {statusMap.DRAFT ?? 0} draft
            </p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Sales Closed</p>
            <p className="stat-value">{totalSales}</p>
            <p className="stat-sub">{salesRangeLabel}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Tenants</p>
            <p className="stat-value">{tenantsTotal}</p>
            <p className="stat-sub">Tenant records on file</p>
          </div>
          {isAdmin ? (
            <div className="stat-card">
              <p className="stat-label">Total Agents</p>
              <p className="stat-value">{agentsTotal}</p>
              <p className="stat-sub">Registered on platform</p>
            </div>
          ) : (
            <div className="stat-card stat-card-money">
              <p className="stat-label">My Commission</p>
              <p className="stat-value" style={{ fontSize: "1.5rem", color: "var(--brand-gold)" }}>
                {formatPKR(myCommissionPKR)}
              </p>
              <p className="stat-sub">
                ≈ {formatCurrency(myCommissionGBP)} · {totalSales} {totalSales === 1 ? "sale" : "sales"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Financial Summary (only shown when there are sales) ──────── */}
      {hasFinancials && (
        <div>
          <p className="section-label">Financial Summary</p>
          <div className="grid-cards">
            <div className="stat-card stat-card-money">
              <p className="stat-label">Total Revenue</p>
              <p className="stat-value stat-value-money" style={{ fontSize: "1.65rem" }}>
                {formatCurrency(totalRevenue)}
              </p>
              <p className="stat-pkr-sub">{formatPKR(gbpToPkr(totalRevenue))}</p>
            </div>
            <div className="stat-card stat-card-money">
              <p className="stat-label">Co. Commission</p>
              <p className="stat-value stat-value-money" style={{ fontSize: "1.65rem" }}>
                {formatCurrency(totalCommission)}
              </p>
              <p className="stat-pkr-sub">{formatPKR(gbpToPkr(totalCommission))}</p>
            </div>
            <div className="stat-card stat-card-profit">
              <p className="stat-label">Net Profit</p>
              <p className="stat-value stat-value-profit" style={{ fontSize: "1.65rem" }}>
                {formatCurrency(totalProfit)}
              </p>
              <p className="stat-pkr-sub">{formatPKR(gbpToPkr(totalProfit))}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Avg Sale Value</p>
              <p className="stat-value" style={{ fontSize: "1.65rem" }}>
                {totalSales > 0 ? formatCurrency(Math.round(totalRevenue / totalSales)) : "—"}
              </p>
              {totalSales > 0 && (
                <p className="stat-pkr-sub">{formatPKR(gbpToPkr(Math.round(totalRevenue / totalSales)))}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Properties by Status ────────────────────────────────────────── */}
      {propertiesTotal > 0 && (
        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="section-label" style={{ marginBottom: "0.75rem" }}>My Properties by Status</p>
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
      )}

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <div>
        <p className="section-label">Quick Actions</p>
        <div className="agent-actions-grid">
          <Link href="/portal/properties/add" className="agent-action-card">
            <div className="agent-action-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v11a3 3 0 1 0 6 0V4a2 2 0 0 0-2-2H4Zm1 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5-1.757 4.9-4.9a2 2 0 0 0 0-2.828L13.485 5.1a2 2 0 0 0-2.828 0L10 5.757v8.486ZM16 17H9.071l6-6H16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="agent-action-label">Add Property</p>
              <p className="agent-action-desc">Register a property for a landlord</p>
            </div>
          </Link>

          <Link href="/landlords" className="agent-action-card">
            <div className="agent-action-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="agent-action-label">My Landlords</p>
              <p className="agent-action-desc">Browse and manage landlords</p>
            </div>
          </Link>

          <Link href="/profile" className="agent-action-card">
            <div className="agent-action-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="agent-action-label">My Profile</p>
              <p className="agent-action-desc">Edit name and password</p>
            </div>
          </Link>

          {isAdmin && (
            <Link href="/admin" className="agent-action-card">
              <div className="agent-action-icon">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L8.196 8.39A5.002 5.002 0 0 1 8 7Zm5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 0 1 14.5 7 .75.75 0 0 0 16 7a3 3 0 0 0-3-3Z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="agent-action-label">Admin Panel</p>
                <p className="agent-action-desc">Manage agents &amp; settings</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ── Two-col: Recent Properties + Recent Sales ───────────────────── */}
      <div className="two-col">

        {/* Recent Properties */}
        <div className="panel">
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
              My Recent Properties
            </h2>
            <Link href="/landlords" style={{ fontSize: "0.82rem", color: "var(--brand-gold)", fontWeight: 600 }}>
              Via Landlords →
            </Link>
          </div>
          {recentPropertyCards.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No properties added yet.<br />
              <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
                Add a landlord to get started.
              </span>
            </div>
          ) : (
            <div style={{ padding: "1.25rem" }}>
              <div className="property-card-grid">
                {recentPropertyCards.map((prop) => (
                  <PropertyPreviewCard
                    key={prop.id}
                    href={`/portal/properties/${prop.id}`}
                    property={prop}
                    landlord={{
                      label: "Landlord",
                      name: prop.landlord.landlordName,
                      href: `/landlords/${prop.landlord.id}`,
                    }}
                    agent={
                      isAdmin && prop.ownerAgent?.agentDisplayName
                        ? { label: "Agent", name: prop.ownerAgent.agentDisplayName }
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent Sales */}
        <div className="panel">
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
              My Recent Sales
            </h2>
            {isAdmin && (
              <Link href="/admin" style={{ fontSize: "0.82rem", color: "var(--brand-gold)", fontWeight: 600 }}>
                Admin View →
              </Link>
            )}
          </div>
          {recentSales.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No sales closed yet.<br />
              <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
                Close a sale on a live property to see data here.
              </span>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Sale Amount</th>
                    <th>Commission</th>
                    <th>Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <Link
                          href={`/landlords/${sale.property.landlord.id}`}
                          style={{ color: "var(--brand-gold)", fontWeight: 600, display: "block" }}
                        >
                          {sale.property.addressLine1}
                        </Link>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {sale.property.city}
                          {isAdmin && sale.closedBy
                            ? ` · ${sale.closedBy.agentDisplayName}`
                            : ""}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#4ade80", display: "block" }}>
                          {formatCurrency(Number(sale.finalAmount))}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {formatPKR(gbpToPkr(Number(sale.finalAmount)))}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: "var(--brand-gold)", display: "block" }}>
                          {formatCurrency(Number(sale.commissionAmount))}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {formatPKR(gbpToPkr(Number(sale.commissionAmount)))}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
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

      {/* ── Recent Tenants ──────────────────────────────────────────────── */}
      {recentTenants.length > 0 && (
        <div className="panel">
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
              Recent Tenants
            </h2>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{tenantsTotal} total</span>
          </div>
          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Contact</th>
                  <th>Property</th>
                  <th>Move-In</th>
                  <th>Rent / Deposit</th>
                  {isAdmin && <th>Agent</th>}
                </tr>
              </thead>
              <tbody>
                {recentTenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td style={{ fontWeight: 600, color: "var(--text)" }}>{tenant.fullName}</td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {tenant.email && <span style={{ display: "block" }}>{tenant.email}</span>}
                      {tenant.phone && <span>{tenant.phone}</span>}
                    </td>
                    <td>
                      {tenant.sale?.property ? (
                        <>
                          <Link
                            href={`/landlords/${tenant.sale.property.landlord.id}`}
                            style={{ color: "var(--brand-gold)", fontWeight: 600, display: "block" }}
                          >
                            {tenant.sale.property.addressLine1 ?? tenant.sale.property.propertyRef ?? "—"}
                          </Link>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {[tenant.sale.property.city, tenant.sale.property.postcode].filter(Boolean).join(", ")}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>No property</span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {tenant.moveInDate
                        ? new Date(tenant.moveInDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>
                      {tenant.rentAmount
                        ? <span style={{ color: "#4ade80", fontWeight: 600 }}>{'\u00A3'}{Number(tenant.rentAmount).toLocaleString("en-GB")}/mo</span>
                        : <span className="muted">—</span>}
                      {tenant.depositAmount
                        ? <span style={{ display: "block", color: "var(--text-muted)", fontSize: "0.75rem" }}>dep: {'\u00A3'}{Number(tenant.depositAmount).toLocaleString("en-GB")}</span>
                        : null}
                    </td>
                    {isAdmin && (
                      <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {tenant.sale?.property.ownerAgent?.agentDisplayName ?? "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── My Recent Landlords ─────────────────────────────────────────── */}
      {recentLandlords.length > 0 && (
        <div className="panel">
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
              My Recent Landlords
            </h2>
            <Link href="/landlords" style={{ fontSize: "0.82rem", color: "var(--brand-gold)", fontWeight: 600 }}>
              View All →
            </Link>
          </div>
          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Number</th>
                  <th>Status</th>
                  {isAdmin && <th>Agent</th>}
                  <th>Properties</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {recentLandlords.map((landlord) => (
                  <tr key={landlord.id}>
                    <td>
                      <Link
                        href={`/landlords/${landlord.id}`}
                        style={{ color: "var(--brand-gold)", fontWeight: 600 }}
                      >
                        {landlord.landlordName}
                      </Link>
                    </td>
                    <td>
                      <code style={{ fontSize: "0.8rem" }}>{landlord.landlordNumber}</code>
                    </td>
                    <td>
                      <span className={`badge ${landlord._count.properties > 0 ? "badge-active" : "badge-passive"}`}>
                        {landlord._count.properties > 0 ? "Active" : "Passive"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        {landlord.ownerAgent?.agentDisplayName ?? "—"}
                      </td>
                    )}
                    <td className="gold" style={{ fontWeight: 700 }}>
                      {landlord._count.properties}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      {formatDate(landlord.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
