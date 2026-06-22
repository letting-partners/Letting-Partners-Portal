"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";

type PotentialTenant = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  interestedIn: string | null;
  budget: string | null;
  notes: string | null;
  createdAt: Date | string;
  addedByAgent: { id: string; agentDisplayName: string };
};

type Props = {
  tenants: PotentialTenant[];
};

export function AdminPotentialTenantsClient({ tenants: initial }: Props) {
  const [tenants] = useState(initial);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredTenants = tenants.filter((tenant) => {
    const haystack = [
      tenant.fullName,
      tenant.email,
      tenant.phone,
      tenant.interestedIn,
      tenant.budget,
      tenant.notes,
      tenant.addedByAgent.agentDisplayName,
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
            placeholder="Name, phone, email, interest, budget"
          />
        </label>
      </div>

      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Interested In</th>
              <th>Budget</th>
              <th>Notes</th>
              <th>Added By</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleTenants.map((tenant) => (
              <tr key={tenant.id}>
                <td style={{ fontWeight: 600, color: "var(--text)" }}>
                  <Link href={`/admin/potential-tenants/${tenant.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                    {tenant.fullName}
                  </Link>
                </td>
                <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {tenant.email && <span style={{ display: "block" }}>{tenant.email}</span>}
                  {tenant.phone && <span>{tenant.phone}</span>}
                  {!tenant.email && !tenant.phone && <span className="muted">-</span>}
                </td>
                <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {tenant.interestedIn ?? <span className="muted">-</span>}
                </td>
                <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {tenant.budget ?? <span className="muted">-</span>}
                </td>
                <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: "14rem" }}>
                  {tenant.notes
                    ? <span title={tenant.notes}>{tenant.notes.length > 60 ? `${tenant.notes.slice(0, 60)}...` : tenant.notes}</span>
                    : <span className="muted">-</span>}
                </td>
                <td>
                  <Link href={`/admin/agents/${tenant.addedByAgent.id}`} style={{ fontSize: "0.82rem", color: "var(--brand-gold)", fontWeight: 600 }}>
                    {tenant.addedByAgent.agentDisplayName}
                  </Link>
                </td>
                <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {new Date(tenant.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td>
                  <AdminDeleteButton
                    label="Delete"
                    confirmMessage={`Permanently delete potential tenant "${tenant.fullName}"? This cannot be undone.`}
                    deleteUrl={`/api/potential-tenants?id=${tenant.id}`}
                  />
                </td>
              </tr>
            ))}
            {visibleTenants.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No potential tenants match your search.
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
