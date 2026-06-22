"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDate } from "@/lib/format";

type TenantRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  moveInDate: Date | string | null;
  rentAmount: string | number | null;
  depositAmount: string | number | null;
  createdAt: Date | string;
  sale: {
    property: {
      id: string;
      propertyRef: string;
      addressLine1: string | null;
      city: string | null;
      postcode: string | null;
      ownerAgent: { id: string; agentDisplayName: string };
    };
  } | null;
  addedByAgent: {
    id: string;
    agentDisplayName: string;
  } | null;
};

type Props = {
  tenants: TenantRow[];
};

export function AdminTenantsClient({ tenants: initial }: Props) {
  const [tenants] = useState(initial);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredTenants = tenants.filter((tenant) => {
    const property = tenant.sale?.property ?? null;
    const agent = property?.ownerAgent ?? tenant.addedByAgent ?? null;
    const haystack = [
      tenant.fullName,
      tenant.email,
      tenant.phone,
      property?.propertyRef,
      property?.addressLine1,
      property?.city,
      property?.postcode,
      agent?.agentDisplayName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.trim().toLowerCase());
  });

  const totalPages = filteredTenants.length === 0 ? 0 : Math.ceil(filteredTenants.length / pageSize);
  const visibleTenants = filteredTenants.slice((page - 1) * pageSize, page * pageSize);

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
            placeholder="Tenant, phone, email, property, agent"
          />
        </label>
      </div>

      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Contact</th>
              <th>Property</th>
              <th>Agent</th>
              <th>Move-In</th>
              <th>Rent / Deposit</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleTenants.map((tenant) => {
              const property = tenant.sale?.property ?? null;
              const agent = property?.ownerAgent ?? tenant.addedByAgent ?? null;
              return (
                <tr key={tenant.id}>
                  <td style={{ fontWeight: 600, color: "var(--text)" }}>
                    <Link href={`/admin/tenants/${tenant.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                      {tenant.fullName}
                    </Link>
                  </td>
                  <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {tenant.email && <span style={{ display: "block" }}>{tenant.email}</span>}
                    {tenant.phone && <span>{tenant.phone}</span>}
                  </td>
                  <td>
                    {property ? (
                      <>
                        <Link
                          href={`/admin/properties/${property.id}`}
                          style={{ color: "var(--brand-gold)", textDecoration: "none", fontWeight: 600, display: "block" }}
                        >
                          {property.addressLine1 ?? property.propertyRef ?? "-"}
                        </Link>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {[property.city, property.postcode].filter(Boolean).join(", ")}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>No property</span>
                    )}
                  </td>
                  <td>
                    {agent ? (
                      <Link href={`/admin/agents/${agent.id}`} style={{ fontSize: "0.82rem", color: "var(--brand-gold)" }}>
                        {agent.agentDisplayName}
                      </Link>
                    ) : (
                      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>-</span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {tenant.moveInDate
                      ? new Date(tenant.moveInDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {tenant.rentAmount ? (
                      <span style={{ color: "#4ade80", fontWeight: 600 }}>
                        {'\u00A3'}{Number(tenant.rentAmount).toLocaleString("en-GB")}/mo
                      </span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                    {tenant.depositAmount ? (
                      <span style={{ display: "block", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                        dep: {'\u00A3'}{Number(tenant.depositAmount).toLocaleString("en-GB")}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {formatDate(tenant.createdAt)}
                  </td>
                  <td>
                    <AdminDeleteButton
                      label="Delete"
                      confirmMessage={`Permanently delete tenant record for "${tenant.fullName}"? The associated sale record will remain. This cannot be undone.`}
                      deleteUrl={`/api/admin/tenants?id=${tenant.id}`}
                    />
                  </td>
                </tr>
              );
            })}
            {visibleTenants.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No tenant records match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "0 1.25rem 1.25rem" }}>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={filteredTenants.length}
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
