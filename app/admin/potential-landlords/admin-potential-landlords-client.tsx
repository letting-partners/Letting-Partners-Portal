"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";

type PotentialLandlord = {
  id: string;
  fullName: string;
  phoneLast10: string;
  createdAt: Date | string;
  addedByAgent: { id: string; agentDisplayName: string };
};

type Props = {
  landlords: PotentialLandlord[];
};

const LOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getLockExpiry(createdAt: Date) {
  return new Date(createdAt.getTime() + LOCK_DURATION_MS);
}

function isLockActive(createdAt: Date) {
  return getLockExpiry(createdAt) > new Date();
}

export function AdminPotentialLandlordsClient({ landlords: initial }: Props) {
  const [landlords] = useState(initial);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredLandlords = landlords.filter((landlord) => {
    const haystack = [
      landlord.fullName,
      landlord.phoneLast10,
      landlord.addedByAgent.agentDisplayName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.trim().toLowerCase());
  });

  const totalPages = filteredLandlords.length === 0 ? 0 : Math.ceil(filteredLandlords.length / pageSize);
  const visibleLandlords = filteredLandlords.slice((page - 1) * pageSize, page * pageSize);

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
            placeholder="Name, phone, agent"
          />
        </label>
      </div>

      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Added By</th>
              <th>Lock Status</th>
              <th>Date Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleLandlords.map((landlord) => {
              const createdAt = new Date(landlord.createdAt);
              const locked = isLockActive(createdAt);
              const expiry = getLockExpiry(createdAt);
              return (
                <tr key={landlord.id}>
                  <td style={{ fontWeight: 600, color: "var(--text)" }}>
                    <Link href={`/admin/potential-landlords/${landlord.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                      {landlord.fullName}
                    </Link>
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    +44{landlord.phoneLast10}
                  </td>
                  <td>
                    <Link href={`/admin/agents/${landlord.addedByAgent.id}`} style={{ fontSize: "0.82rem", color: "var(--brand-gold)", fontWeight: 600 }}>
                      {landlord.addedByAgent.agentDisplayName}
                    </Link>
                  </td>
                  <td>
                    {locked ? (
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "#facc15",
                          background: "rgba(250,204,21,0.1)",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "0.3rem",
                        }}
                      >
                        Locked until {expiry.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                          background: "rgba(255,255,255,0.05)",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "0.3rem",
                        }}
                      >
                        Unlocked
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <AdminDeleteButton
                      label="Delete"
                      confirmMessage={`Permanently delete potential landlord "${landlord.fullName}"? This cannot be undone.`}
                      deleteUrl={`/api/potential-landlords?id=${landlord.id}`}
                    />
                  </td>
                </tr>
              );
            })}
            {visibleLandlords.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No potential landlords match your search.
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
          total={filteredLandlords.length}
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
