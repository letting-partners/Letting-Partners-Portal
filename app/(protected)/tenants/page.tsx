"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { updateTenant, type TenantRow } from "@/lib/portal-api";
import { apiGet } from "@/lib/api-client";

type TenantWithProperty = TenantRow & {
  sale?: {
    property: {
      id: string;
      propertyRef: string;
      addressLine1: string | null;
      city: string | null;
      postcode: string | null;
      landlord: { id: string; landlordName: string };
    };
  } | null;
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "", email: "", currentAddress: "",
    moveInDate: "", rentAmount: "", depositAmount: "", notes: "",
  });
  const [editBusy, setEditBusy] = useState(false);

  async function load() {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));

    const result = await apiGet<{
      tenants: TenantWithProperty[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(`/api/tenants?${query.toString()}`);
    setLoading(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load tenants." });
      return;
    }
    setTenants(result.data.tenants);
    setTotal(result.data.pagination.total);
    setTotalPages(result.data.pagination.totalPages);
  }

  useEffect(() => { void load(); }, [page, pageSize, search]);

  function startEdit(tenant: TenantWithProperty) {
    setEditId(tenant.id);
    setEditForm({
      fullName: tenant.fullName,
      email: tenant.email ?? "",
      currentAddress: tenant.currentAddress ?? "",
      moveInDate: tenant.moveInDate ? new Date(tenant.moveInDate).toISOString().slice(0, 10) : "",
      rentAmount: tenant.rentAmount ?? "",
      depositAmount: tenant.depositAmount ?? "",
      notes: tenant.notes ?? "",
    });
    setMessage(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditBusy(true);
    const result = await updateTenant(editId, {
      fullName: editForm.fullName.trim() || undefined,
      email: editForm.email.trim() || null,
      currentAddress: editForm.currentAddress.trim() || null,
      moveInDate: editForm.moveInDate ? new Date(editForm.moveInDate).toISOString() : null,
      rentAmount: editForm.rentAmount.trim() ? Number(editForm.rentAmount) : null,
      depositAmount: editForm.depositAmount.trim() ? Number(editForm.depositAmount) : null,
      notes: editForm.notes.trim() || null,
    });
    setEditBusy(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update tenant." });
      return;
    }

    if (result.data.approvalRequired) {
      setMessage({
        type: "success",
        text: result.data.message ?? "Changes submitted for admin approval.",
      });
      setEditId(null);
      return;
    }

    setMessage({ type: "success", text: "Tenant updated." });
    setEditId(null);
    await load();
  }

  const totalRecords = total;
  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Tenants</h1>
          <p className="page-subtitle">{totalRecords} tenant {totalRecords === 1 ? "record" : "records"}. Tenants are added automatically when closing a sale.</p>
        </div>
      </header>

      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <div className="panel" style={{ padding: "1rem 1.25rem" }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="label">Search</span>
          <UIInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Tenant, phone, email, property, landlord, agent"
          />
        </label>
      </div>

      <div className="panel">
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>All Tenants</h2>
        </div>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Loading tenants...
          </div>
        ) : tenants.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            {search ? "No tenant records match your search." : "No tenant records yet."}
          </div>
        ) : (
          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Property</th>
                  <th>Move-In</th>
                  <th>Rent / Deposit</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => {
                  const editing = editId === tenant.id;
                  return (
                    <tr key={tenant.id}>
                      <td style={{ fontWeight: 600 }}>
                        {editing ? (
                          <UIInput value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} disabled={editBusy} />
                        ) : (
                          <Link href={`/tenants/${tenant.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                            {tenant.fullName}
                          </Link>
                        )}
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        {tenant.phone ?? "—"}
                        <span className="hint-text" style={{ display: "block" }}>read-only</span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {editing ? (
                          <UIInput placeholder="Email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} disabled={editBusy} />
                        ) : (tenant.email ?? "—")}
                      </td>
                      <td>
                        {tenant.sale?.property ? (
                          <>
                            <Link href={`/landlords/${tenant.sale.property.landlord.id}`}
                              style={{ color: "var(--brand-gold)", fontWeight: 600, display: "block" }}>
                              {tenant.sale.property.addressLine1 ?? tenant.sale.property.propertyRef ?? "—"}
                            </Link>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {[tenant.sale.property.city, tenant.sale.property.postcode].filter(Boolean).join(", ")}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>No property yet</span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {editing ? (
                          <UIInput type="date" value={editForm.moveInDate} onChange={(e) => setEditForm((p) => ({ ...p, moveInDate: e.target.value }))} disabled={editBusy} />
                        ) : tenant.moveInDate
                          ? new Date(tenant.moveInDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {editing ? (
                          <div className="stack" style={{ gap: "0.35rem" }}>
                            <UIInput type="number" min={0} step="0.01" placeholder="Rent/mo" value={editForm.rentAmount} onChange={(e) => setEditForm((p) => ({ ...p, rentAmount: e.target.value }))} disabled={editBusy} />
                            <UIInput type="number" min={0} step="0.01" placeholder="Deposit" value={editForm.depositAmount} onChange={(e) => setEditForm((p) => ({ ...p, depositAmount: e.target.value }))} disabled={editBusy} />
                          </div>
                        ) : (
                          <>
                            {tenant.rentAmount
                              ? <span style={{ color: "#4ade80", fontWeight: 600 }}>{'\u00A3'}{Number(tenant.rentAmount).toLocaleString("en-GB")}/mo</span>
                              : <span className="muted">—</span>}
                            {tenant.depositAmount && (
                              <span style={{ display: "block", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                dep: {'\u00A3'}{Number(tenant.depositAmount).toLocaleString("en-GB")}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: "12rem" }}>
                        {editing ? (
                          <UIInput placeholder="Notes" value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} disabled={editBusy} />
                        ) : tenant.notes
                          ? <span title={tenant.notes}>{tenant.notes.length > 50 ? tenant.notes.slice(0, 50) + "…" : tenant.notes}</span>
                          : "—"}
                      </td>
                      <td>
                        {editing ? (
                          <div className="inline-row">
                            <UIButton onClick={() => void saveEdit()} disabled={editBusy}>{editBusy ? "Saving..." : "Save"}</UIButton>
                            <UIButton variant="secondary" onClick={() => setEditId(null)} disabled={editBusy}>Cancel</UIButton>
                          </div>
                        ) : (
                          <UIButton variant="secondary" onClick={() => startEdit(tenant)}>Edit</UIButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalRecords > 0 ? (
          <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
            <PaginationControls
              page={page}
              pageSize={pageSize}
              total={totalRecords}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
