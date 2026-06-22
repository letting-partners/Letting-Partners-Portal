"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatCurrency, formatDate, formatPKR, gbpToPkr } from "@/lib/format";
import { apiDelete } from "@/lib/api-client";

type SaleRow = {
  id: string;
  finalAmount: number;
  commissionAmount: number;
  profit: number;
  agentCommissionGBP: number;
  closedAt: Date;
  closedBy: { id: string; agentDisplayName: string } | null;
  property: {
    id: string;
    propertyRef: string;
    addressLine1: string | null;
    city: string | null;
    postcode: string | null;
    landlord: { id: string; landlordName: string };
  };
  tenant: { id: string; fullName: string } | null;
};

type Props = {
  sales: SaleRow[];
};

export function AdminSalesClient({ sales }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [clearing, setClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleClearAllSales() {
    if (!window.confirm(`This will permanently delete ALL ${sales.length} sale record(s) and reset closed properties to Available. This cannot be undone. Continue?`)) return;
    setClearing(true);
    setClearMessage(null);
    const result = await apiDelete<{ ok: boolean; message: string; cleared: number }>("/api/admin/sales");
    setClearing(false);
    if (!result.ok) {
      setClearMessage({ type: "error", text: result.message ?? "Failed to clear sales." });
      return;
    }
    setClearMessage({ type: "success", text: result.data.message });
    setTimeout(() => router.refresh(), 1000);
  }

  const filteredSales = sales.filter((sale) => {
    const haystack = [
      sale.property.propertyRef,
      sale.property.addressLine1,
      sale.property.city,
      sale.property.postcode,
      sale.property.landlord.landlordName,
      sale.closedBy?.agentDisplayName,
      sale.tenant?.fullName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.trim().toLowerCase());
  });

  const totalPages = filteredSales.length === 0 ? 0 : Math.ceil(filteredSales.length / pageSize);
  const visibleSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);
  const totals = filteredSales.reduce(
    (acc, sale) => {
      acc.finalAmount += sale.finalAmount;
      acc.commissionAmount += sale.commissionAmount;
      acc.profit += sale.profit;
      acc.agentCommissionGBP += sale.agentCommissionGBP;
      return acc;
    },
    { finalAmount: 0, commissionAmount: 0, profit: 0, agentCommissionGBP: 0 },
  );

  return (
    <div className="stack">
      <div style={{ padding: "0 1.25rem 1rem", display: "flex", alignItems: "flex-end", gap: "1rem", flexWrap: "wrap" }}>
        <label className="field" style={{ marginBottom: 0, flex: 1 }}>
          <span className="label">Search</span>
          <UIInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Property, postcode, landlord, agent, tenant"
          />
        </label>
        {sales.length > 0 && (
          <UIButton
            variant="danger"
            onClick={() => void handleClearAllSales()}
            disabled={clearing}
          >
            {clearing ? "Clearing..." : "Clear All Sales"}
          </UIButton>
        )}
      </div>

      {clearMessage && (
        <div style={{ padding: "0 1.25rem" }}>
          <div style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            background: clearMessage.type === "error" ? "rgba(220,50,50,0.12)" : "rgba(74,222,128,0.12)",
            border: `1px solid ${clearMessage.type === "error" ? "rgba(220,50,50,0.3)" : "rgba(74,222,128,0.3)"}`,
            color: clearMessage.type === "error" ? "#e05555" : "#4ade80",
            fontSize: "0.875rem",
          }}>
            {clearMessage.text}
          </div>
        </div>
      )}

      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Landlord</th>
              <th>Agent</th>
              <th>Sale Amount</th>
              <th>Company Commission</th>
              <th>Net Profit</th>
              <th>Agent Comm.</th>
              <th>Tenant</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody>
            {visibleSales.map((sale) => (
              <tr key={sale.id}>
                <td>
                  <Link href={`/admin/sales/${sale.id}`} style={{ color: "var(--brand-gold)", fontWeight: 600, display: "block", textDecoration: "none" }}>
                    {sale.property.addressLine1 ?? sale.property.propertyRef}
                  </Link>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {[sale.property.city, sale.property.postcode].filter(Boolean).join(", ")}
                  </span>
                </td>
                <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {sale.property.landlord.landlordName}
                </td>
                <td>
                  {sale.closedBy ? (
                    <Link href={`/admin/agents/${sale.closedBy.id}`} style={{ fontSize: "0.82rem", color: "var(--brand-gold)" }}>
                      {sale.closedBy.agentDisplayName}
                    </Link>
                  ) : null}
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "#4ade80", display: "block" }}>{formatCurrency(sale.finalAmount)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatPKR(gbpToPkr(sale.finalAmount))}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "var(--brand-gold)", display: "block" }}>{formatCurrency(sale.commissionAmount)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatPKR(gbpToPkr(sale.commissionAmount))}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: "#22d3ee", display: "block" }}>{formatCurrency(sale.profit)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatPKR(gbpToPkr(sale.profit))}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: "#c084fc", display: "block" }}>{formatCurrency(sale.agentCommissionGBP)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatPKR(gbpToPkr(sale.agentCommissionGBP))}</span>
                </td>
                <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {sale.tenant ? (
                    <Link href={`/admin/tenants/${sale.tenant.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                      {sale.tenant.fullName}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {formatDate(sale.closedAt)}
                </td>
              </tr>
            ))}
            {visibleSales.length === 0 ? (
              <tr>
                <td colSpan={9} className="muted">
                  No sales match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
          {filteredSales.length > 1 ? (
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td colSpan={3} style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: "0.82rem", padding: "0.6rem 0.75rem" }}>
                  Totals ({filteredSales.length} sales)
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "#4ade80", display: "block" }}>{formatCurrency(totals.finalAmount)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatPKR(gbpToPkr(totals.finalAmount))}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "var(--brand-gold)", display: "block" }}>{formatCurrency(totals.commissionAmount)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatPKR(gbpToPkr(totals.commissionAmount))}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "#22d3ee", display: "block" }}>{formatCurrency(totals.profit)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatPKR(gbpToPkr(totals.profit))}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "#c084fc", display: "block" }}>{formatCurrency(totals.agentCommissionGBP)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatPKR(gbpToPkr(totals.agentCommissionGBP))}</span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div style={{ padding: "0 1.25rem 1.25rem" }}>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={filteredSales.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
