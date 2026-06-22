"use client";

import Link from "next/link";
import { useState } from "react";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { AGENT_COMMISSION_PKR, formatCurrency, formatDate, formatPKR, gbpToPkr, pkrToGbp } from "@/lib/format";

type SaleRow = {
  id: string;
  finalAmount: number;
  commissionAmount: number;
  profit: number;
  closedAt: Date;
  property: {
    id: string;
    propertyRef: string;
    addressLine1: string | null;
    city: string | null;
    postcode: string | null;
    landlord: { id: string; landlordName: string };
  };
  tenant: {
    id: string;
    fullName: string;
  } | null;
};

type Props = {
  sales: SaleRow[];
};

export function SalesClient({ sales }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredSales = sales.filter((sale) => {
    const haystack = [
      sale.property.propertyRef,
      sale.property.addressLine1,
      sale.property.city,
      sale.property.postcode,
      sale.property.landlord.landlordName,
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
      return acc;
    },
    { finalAmount: 0, commissionAmount: 0, profit: 0 },
  );

  return (
    <div className="stack">
      <div style={{ padding: "0 1.25rem 1rem" }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="label">Search</span>
          <UIInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Property, postcode, landlord, tenant"
          />
        </label>
      </div>

      <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Property</th>
              <th>Landlord</th>
              <th>Sale Amount</th>
              <th>Company Commission</th>
              <th>Net Profit</th>
              <th>My Comm.</th>
              <th>Tenant</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody>
            {visibleSales.map((sale, idx) => (
              <tr key={sale.id}>
                <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{(page - 1) * pageSize + idx + 1}</td>
                <td>
                  <Link href={`/sales/${sale.id}`} style={{ color: "var(--brand-gold)", fontWeight: 600, display: "block", textDecoration: "none" }}>
                    {sale.property.addressLine1 ?? sale.property.propertyRef}
                  </Link>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {[sale.property.city, sale.property.postcode].filter(Boolean).join(", ")}
                  </span>
                </td>
                <td>
                  <Link href={`/landlords/${sale.property.landlord.id}`} style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {sale.property.landlord.landlordName}
                  </Link>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "#4ade80", display: "block" }}>
                    {formatCurrency(sale.finalAmount)}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {formatPKR(gbpToPkr(sale.finalAmount))}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: "var(--brand-gold)", display: "block" }}>
                    {formatCurrency(sale.commissionAmount)}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {formatPKR(gbpToPkr(sale.commissionAmount))}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: "#22d3ee", display: "block" }}>
                    {formatCurrency(sale.profit)}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {formatPKR(gbpToPkr(sale.profit))}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "var(--brand-gold)", display: "block" }}>
                    {formatPKR(AGENT_COMMISSION_PKR)}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    ~ {formatCurrency(pkrToGbp(AGENT_COMMISSION_PKR))}
                  </span>
                </td>
                <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {sale.tenant ? (
                    <Link href={`/tenants/${sale.tenant.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
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
                  <span style={{ fontWeight: 700, color: "var(--brand-gold)", display: "block" }}>{formatPKR(filteredSales.length * AGENT_COMMISSION_PKR)}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    ~ {formatCurrency(pkrToGbp(filteredSales.length * AGENT_COMMISSION_PKR))}
                  </span>
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
