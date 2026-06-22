import Link from "next/link";
import { UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { serializePropertyImageList } from "@/server/property-media";
import { SalesFilterBar } from "@/components/sales-filter-bar";
import { formatPeriodRange, isPeriodKey, parsePeriodToDateRange, type PeriodKey } from "@/lib/period";
import { AgentReportClient } from "./agent-report-client";

export const dynamic = "force-dynamic";

function firstVal(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

type Props = {
  params: { id: string };
  searchParams?: {
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
  };
};

export default async function AdminAgentDetailPage({ params, searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const admin = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!admin || !admin.isActive) redirect("/admin/login");
  if (admin.role !== UserRole.ADMIN) redirect("/dashboard");

  const requestedPeriod = firstVal(searchParams?.period);
  const period: PeriodKey = isPeriodKey(requestedPeriod) ? requestedPeriod : "month";
  const from = firstVal(searchParams?.from);
  const to = firstVal(searchParams?.to);
  const salesRange = parsePeriodToDateRange(period, from, to);
  const salesRangeLabel = formatPeriodRange(salesRange);

  const salesWhere = {
    closedByUserId: params.id,
    ...(salesRange ? { closedAt: { gte: salesRange.gte, lte: salesRange.lte } } : {}),
  };

  const [agent, sales, landlords, tenants, potentialTenants, potentialLandlords, transferTargets] = await Promise.all([
    db.user.findFirst({
      where: { id: params.id, role: UserRole.AGENT },
      select: {
        id: true,
        email: true,
        agentDisplayName: true,
        isActive: true,
        createdAt: true,
        dialerSetting: {
          select: {
            extensionNumber: true,
          },
        },
        _count: { select: { ownedLandlords: true, ownedProperties: true } },
        ownedProperties: {
          orderBy: { createdAt: "desc" },
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
            createdAt: true,
            landlord: { select: { id: true, landlordName: true } },
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
        },
      },
    }),
    db.sale.findMany({
      where: salesWhere,
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
          },
        },
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            moveInDate: true,
            rentAmount: true,
            depositAmount: true,
          },
        },
      },
    }),
    db.landlord.findMany({
      where: { ownerAgentId: params.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        landlordName: true,
        landlordNumber: true,
        email: true,
        phoneE164: true,
        createdAt: true,
        _count: { select: { properties: true } },
      },
    }),
    db.tenant.findMany({
      where: {
        OR: [
          { sale: { property: { ownerAgentId: params.id } } },
          { addedByAgentId: params.id, saleId: null },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
              },
            },
          },
        },
      },
    }),
    db.potentialTenant.findMany({
      where: { addedByAgentId: params.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        interestedIn: true,
        budget: true,
        createdAt: true,
      },
    }),
    db.potentialLandlord.findMany({
      where: { addedByAgentId: params.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        phoneLast10: true,
        createdAt: true,
      },
    }),
    db.user.findMany({
      where: {
        role: UserRole.AGENT,
        isActive: true,
        id: { not: params.id },
      },
      orderBy: [{ agentDisplayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        agentDisplayName: true,
        email: true,
      },
    }),
  ]);

  if (!agent) notFound();

  const agentNumber = agent.dialerSetting?.extensionNumber?.trim() || null;
  const agentProperties = serializePropertyImageList(agent.ownedProperties);
  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.finalAmount), 0);
  const totalCommission = sales.reduce((sum, sale) => sum + Number(sale.commissionAmount), 0);
  const totalProfit = sales.reduce((sum, sale) => sum + Number(sale.profit), 0);
  const tenantSales = sales.filter((sale) => sale.tenant != null);

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Link
            href="/admin/agents"
            style={{
              display: "inline-block",
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              textDecoration: "none",
              marginBottom: "0.35rem",
            }}
          >
            {"<-"} Back to Agents
          </Link>
          <h1 className="page-title">{agent.agentDisplayName}</h1>
          <p className="page-subtitle">
            {[agentNumber ? `Agent Number ${agentNumber}` : null, agent.email, agent.isActive ? "Active" : "Disabled", `Joined ${formatDate(agent.createdAt)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span
          className={`badge ${agent.isActive ? "badge-active" : "badge-locked"}`}
          style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem" }}
        >
          {agent.isActive ? "Active" : "Disabled"}
        </span>
      </header>

      <div className="panel" style={{ padding: "1rem 1.1rem" }}>
        <SalesFilterBar period={period} from={from} to={to} rangeLabel={salesRangeLabel} salesCount={sales.length} />
      </div>

      <div className="admin-stats-grid-wide">
        <div className="admin-stat-card">
          <p className="admin-stat-label">Landlords</p>
          <p className="admin-stat-value">{agent._count.ownedLandlords}</p>
          <p className="admin-stat-sub">All time</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Properties</p>
          <p className="admin-stat-value">{agent._count.ownedProperties}</p>
          <p className="admin-stat-sub">All time</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Sales Closed</p>
          <p className="admin-stat-value" style={{ color: sales.length > 0 ? "#4ade80" : undefined }}>
            {sales.length}
          </p>
          <p className="admin-stat-sub">{salesRangeLabel}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Tenants</p>
          <p className="admin-stat-value" style={{ color: tenantSales.length > 0 ? "var(--brand-gold)" : undefined }}>
            {tenants.length}
          </p>
          <p className="admin-stat-sub">All records</p>
        </div>
        <div className="admin-stat-card" style={{ borderTopColor: "var(--brand-gold)" }}>
          <p className="admin-stat-label">Commission</p>
          <p className="admin-stat-value" style={{ fontSize: "1.8rem" }}>
            {totalCommission > 0 ? formatCurrency(totalCommission) : "-"}
          </p>
          <p className="admin-stat-sub">{salesRangeLabel}</p>
        </div>
        <div className="admin-stat-card" style={{ borderTopColor: "var(--success)" }}>
          <p className="admin-stat-label">Revenue</p>
          <p className="admin-stat-value" style={{ color: "#4ade80", fontSize: "1.8rem" }}>
            {totalRevenue > 0 ? formatCurrency(totalRevenue) : "-"}
          </p>
          <p className="admin-stat-sub">{salesRangeLabel}</p>
        </div>
        <div className="admin-stat-card" style={{ borderTopColor: "#06b6d4" }}>
          <p className="admin-stat-label">Net Profit</p>
          <p className="admin-stat-value" style={{ color: "#22d3ee", fontSize: "1.8rem" }}>
            {totalProfit > 0 ? formatCurrency(totalProfit) : "-"}
          </p>
          <p className="admin-stat-sub">{salesRangeLabel}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Potentials</p>
          <p className="admin-stat-value" style={{ fontSize: "1.8rem" }}>
            {potentialTenants.length + potentialLandlords.length}
          </p>
          <p className="admin-stat-sub">Tenants + landlords</p>
        </div>
      </div>

      <AgentReportClient
        sourceAgentId={agent.id}
        sourceAgentName={agent.agentDisplayName}
        transferTargets={transferTargets}
        properties={agentProperties}
        landlords={landlords}
        tenants={tenants.map((tenant) => ({
          ...tenant,
          rentAmount: tenant.rentAmount === null ? null : Number(tenant.rentAmount),
          depositAmount: tenant.depositAmount === null ? null : Number(tenant.depositAmount),
        }))}
        sales={sales.map((sale) => ({
          ...sale,
          finalAmount: Number(sale.finalAmount),
          commissionAmount: Number(sale.commissionAmount),
          profit: Number(sale.profit),
          tenant: sale.tenant
            ? {
                ...sale.tenant,
                rentAmount: sale.tenant.rentAmount === null ? null : Number(sale.tenant.rentAmount),
                depositAmount: sale.tenant.depositAmount === null ? null : Number(sale.tenant.depositAmount),
              }
            : null,
        }))}
        potentialTenants={potentialTenants}
        potentialLandlords={potentialLandlords}
      />
    </div>
  );
}
