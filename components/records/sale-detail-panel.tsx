import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/format";

type SaleDetail = {
  id: string;
  finalAmount: number;
  commissionPct: number;
  commissionAmount: number;
  otherCosts: number | null;
  profit: number;
  closedAt: Date;
  property: {
    id: string;
    propertyRef: string;
    addressLine1: string | null;
    city: string | null;
    postcode: string | null;
    landlord: {
      id: string;
      landlordName: string;
    };
    ownerAgent: {
      id: string;
      agentDisplayName: string;
      email: string;
    };
  };
  tenant: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    currentAddress: string | null;
    moveInDate: Date | null;
    rentAmount: number | null;
    depositAmount: number | null;
    notes: string | null;
  } | null;
  closedBy: {
    id: string;
    agentDisplayName: string;
    email: string;
  };
};

type Props = {
  sale: SaleDetail;
  backHref: string;
  backLabel: string;
  propertyHref: string;
  tenantHref: string | null;
  adminMode?: boolean;
};

function money(value: number | null) {
  if (value === null) return "-";
  return formatCurrency(value);
}

export function SaleDetailPanel({
  sale,
  backHref,
  backLabel,
  propertyHref,
  tenantHref,
  adminMode = false,
}: Props) {
  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Sale Details</h1>
          <p className="page-subtitle">
            {sale.property.addressLine1 ?? sale.property.propertyRef} · {formatDateTime(sale.closedAt)}
          </p>
        </div>
        <div className="inline-row">
          <Link className="btn btn-secondary" href={backHref}>
            {backLabel}
          </Link>
        </div>
      </header>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Property & Agent</h2>
        </div>
        <div className="admin-card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Property</span>
              <Link href={propertyHref} className="detail-value" style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                {sale.property.addressLine1 ?? sale.property.propertyRef}
              </Link>
            </div>
            <div className="detail-item">
              <span className="detail-label">Postcode</span>
              <span className="detail-value">{sale.property.postcode ?? "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Landlord</span>
              <Link
                href={`/landlords/${sale.property.landlord.id}`}
                className="detail-value"
                style={{ color: "var(--brand-gold)", textDecoration: "none" }}
              >
                {sale.property.landlord.landlordName}
              </Link>
            </div>
            <div className="detail-item">
              <span className="detail-label">Agent</span>
              {adminMode ? (
                <Link
                  href={`/admin/agents/${sale.property.ownerAgent.id}`}
                  className="detail-value"
                  style={{ color: "var(--brand-gold)", textDecoration: "none" }}
                >
                  {sale.property.ownerAgent.agentDisplayName}
                </Link>
              ) : (
                <span className="detail-value">{sale.property.ownerAgent.agentDisplayName}</span>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-label">Closed By</span>
              <span className="detail-value">{sale.closedBy.agentDisplayName}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Closed At</span>
              <span className="detail-value">{formatDateTime(sale.closedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Financials</h2>
        </div>
        <div className="admin-card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Final Amount</span>
              <span className="detail-value">{money(sale.finalAmount)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Commission %</span>
              <span className="detail-value">{sale.commissionPct}%</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Commission Amount</span>
              <span className="detail-value">{money(sale.commissionAmount)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Other Costs</span>
              <span className="detail-value">{money(sale.otherCosts)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Profit</span>
              <span className="detail-value">{money(sale.profit)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Tenant</h2>
        </div>
        <div className="admin-card-body">
          {sale.tenant ? (
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Tenant</span>
                {tenantHref ? (
                  <Link href={tenantHref} className="detail-value" style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                    {sale.tenant.fullName}
                  </Link>
                ) : (
                  <span className="detail-value">{sale.tenant.fullName}</span>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Phone</span>
                <span className="detail-value">{sale.tenant.phone ?? "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email</span>
                <span className="detail-value">{sale.tenant.email ?? "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Move-In Date</span>
                <span className="detail-value">{sale.tenant.moveInDate ? formatDateTime(sale.tenant.moveInDate) : "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Rent Amount</span>
                <span className="detail-value">{money(sale.tenant.rentAmount)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Deposit Amount</span>
                <span className="detail-value">{money(sale.tenant.depositAmount)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Current Address</span>
                <span className="detail-value">{sale.tenant.currentAddress ?? "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Notes</span>
                <span className="detail-value">{sale.tenant.notes ?? "-"}</span>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No tenant record is linked to this sale.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
