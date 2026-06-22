"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { PropertyPreviewCard } from "@/components/property-preview-card";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { closePropertySale, closePropertyRoomSale, fetchProperties, togglePropertyWebsitePublish } from "@/lib/portal-api";
import { formatDate } from "@/lib/format";
import { PropertyStatusDropdown } from "@/components/property-status-dropdown";
import { PhoneLookupModal } from "@/components/phone-lookup-modal";

type RoomRow = {
  id: string;
  roomName: string;
  landlordDemand: string | null;
  expectedCommissionPct: string | null;
  status: "AVAILABLE" | "UNDER_OFFER" | "CLOSED";
  sale?: {
    id: string;
    finalAmount: string;
    tenant?: { id: string; fullName: string } | null;
    closedAt: string;
  } | null;
};

type PropertyRow = {
  id: string;
  propertyRef: string;
  title: string | null;
  description: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  status: "DRAFT" | "AVAILABLE" | "CLOSED";
  vacancyType: "SINGLE" | "MULTIPLE";
  createdAt: string;
  images?: Array<{ id: string; name: string; imageUrl?: string; dataUrl?: string }>;
  landlord: { id: string; landlordName: string };
  publishedToWebsite?: boolean;
  rooms?: RoomRow[];
};

type CloseSaleState = {
  propertyId: string;
  roomId?: string;
  roomName?: string;
  address: string;
};

const emptyTenant = {
  fullName: "", phone: "", email: "", currentAddress: "",
  moveInDate: "", rentAmount: "", depositAmount: "", notes: "",
};

const emptySaleForm = {
  finalAmount: "", commissionPct: "", otherCosts: "",
};


function money(val: string | number | null | undefined) {
  if (!val) return "—";
  const n = Number(val);
  return isNaN(n) ? "—" : `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

export default function PropertiesPage() {
  const [showLookup, setShowLookup] = useState(false);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Close-sale modal state
  const [closeSale, setCloseSale] = useState<CloseSaleState | null>(null);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [tenantForm, setTenantForm] = useState(emptyTenant);
  const [closeBusy, setCloseBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  async function load() {
    setLoading(true);
    const result = await fetchProperties({
      search: search || undefined,
      page,
      pageSize,
    });
    setLoading(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load properties." });
      return;
    }
    setProperties(result.data.properties as unknown as PropertyRow[]);
    setTotal(result.data.pagination.total);
    setTotalPages(result.data.pagination.totalPages);
  }

  useEffect(() => { void load(); }, [page, pageSize, search]);

  function openCloseSale(prop: PropertyRow, roomId?: string, roomName?: string) {
    const address = [prop.addressLine1, prop.city, prop.postcode].filter(Boolean).join(", ") || prop.propertyRef;
    setCloseSale({ propertyId: prop.id, roomId, roomName, address });
    setSaleForm(emptySaleForm);
    setTenantForm(emptyTenant);
    setMessage(null);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleCloseSale() {
    if (!closeSale) return;
    if (!saleForm.finalAmount || !saleForm.commissionPct) {
      setMessage({ type: "error", text: "Final amount and commission % are required." });
      return;
    }
    if (!tenantForm.fullName.trim() || !tenantForm.phone.trim()) {
      setMessage({ type: "error", text: "Tenant full name and phone are required." });
      return;
    }

    setCloseBusy(true);
    setMessage(null);

    const salePayload = {
      finalAmount: Number(saleForm.finalAmount),
      commissionPct: Number(saleForm.commissionPct),
      otherCosts: saleForm.otherCosts ? Number(saleForm.otherCosts) : undefined,
      tenant: {
        fullName: tenantForm.fullName.trim(),
        phone: tenantForm.phone.trim(),
        email: tenantForm.email.trim() || undefined,
        currentAddress: tenantForm.currentAddress.trim() || undefined,
        moveInDate: tenantForm.moveInDate ? new Date(tenantForm.moveInDate).toISOString() : undefined,
        rentAmount: tenantForm.rentAmount ? Number(tenantForm.rentAmount) : undefined,
        depositAmount: tenantForm.depositAmount ? Number(tenantForm.depositAmount) : undefined,
        notes: tenantForm.notes.trim() || undefined,
      },
    };

    let result;
    if (closeSale.roomId) {
      result = await closePropertyRoomSale(closeSale.propertyId, closeSale.roomId, salePayload);
    } else {
      result = await closePropertySale(closeSale.propertyId, salePayload);
    }

    setCloseBusy(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to close sale." });
      return;
    }

    setMessage({ type: "success", text: `Sale closed for ${closeSale.address}${closeSale.roomName ? ` — ${closeSale.roomName}` : ""}.` });
    setCloseSale(null);
    await load();
  }

  const byStatus = properties.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="page-subtitle">{total} property {total === 1 ? "record" : "records"}.</p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => setShowLookup(true)}>
            Start a Call
          </button>
          <Link className="btn btn-primary" href="/portal/properties/add">
            Add a Property
          </Link>
        </div>
        <PhoneLookupModal open={showLookup} onClose={() => setShowLookup(false)} />
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
            placeholder="Title, description, address, postcode, landlord, property ref"
          />
        </label>
      </div>

      {/* Status breakdown */}
      {properties.length > 0 && (
        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="section-label" style={{ marginBottom: "0.75rem" }}>By Status</p>
          <div className="status-breakdown">
            {(
              [
                ["AVAILABLE", "Available", "status-item-live"],
                ["DRAFT",     "Draft",     "status-item-draft"],
                ["CLOSED",    "Closed",    "status-item-sold"],
              ] as [string, string, string][]
            ).map(([s, label, cls]) => (
              <div key={s} className={`status-item ${cls}`}>
                <p className="status-item-count">{byStatus[s] ?? 0}</p>
                <p className="status-item-label">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Properties table */}
      <div className="panel">
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>All Properties</h2>
        </div>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Loading properties...</div>
        ) : properties.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            No properties yet. <Link href="/portal/properties/new" style={{ color: "var(--brand-gold)" }}>Add one →</Link>
          </div>
        ) : (
          <>
          <div style={{ padding: "1.25rem" }}>
            <div className="property-card-grid">
              {properties.map((prop) => {
                const isMultiple = prop.vacancyType === "MULTIPLE";
                const canClose = prop.status !== "CLOSED" && !isMultiple;

                return (
                  <PropertyPreviewCard
                    key={prop.id}
                    href={`/portal/properties/${prop.id}`}
                    property={prop}
                    landlord={{
                      label: "Landlord",
                      name: prop.landlord.landlordName,
                      href: `/landlords/${prop.landlord.id}`,
                    }}
                    extra={
                      isMultiple ? (
                        <div className="stack" style={{ gap: "0.75rem" }}>
                          <div className="property-preview-section-label">Rooms</div>
                          <div className="room-chip-list">
                            {(prop.rooms ?? []).map((room) => (
                              <div key={room.id} className="room-chip">
                                <div className="room-chip-head">
                                  <strong>{room.roomName}</strong>
                                  <span className={`badge ${room.status === "AVAILABLE" ? "badge-active" : room.status === "CLOSED" ? "badge-sold" : "badge-offer"}`}>
                                    {room.status}
                                  </span>
                                </div>
                                <div className="room-chip-sub">
                                  {room.landlordDemand ? money(room.landlordDemand) : "No demand"}
                                  {room.sale?.tenant?.fullName ? ` | ${room.sale.tenant.fullName}` : ""}
                                </div>
                                {room.status !== "CLOSED" ? (
                                  <UIButton
                                    type="button"
                                    variant="secondary"
                                    className="property-card-inline-action"
                                    onClick={() => openCloseSale(prop, room.id, room.roomName)}
                                  >
                                    Close Sale
                                  </UIButton>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null
                    }
                    footer={(
                      <div className="property-preview-footer-stack">
                        <div className="property-card-footer-note">Added {formatDate(prop.createdAt)}</div>
                        <div className="property-card-action-row" style={{ flexWrap: "wrap", gap: "0.5rem", display: "flex", alignItems: "center" }}>
                          <UIButton
                            type="button"
                            variant="secondary"
                            className="property-card-action-btn"
                            style={{ 
                              color: prop.publishedToWebsite ? "var(--success)" : "inherit",
                              borderColor: prop.publishedToWebsite ? "var(--success)" : "inherit"
                            }}
                            onClick={async () => {
                              const newStatus = !prop.publishedToWebsite;
                              setProperties(prev => prev.map(p => p.id === prop.id ? { ...p, publishedToWebsite: newStatus } : p));
                              const res = await togglePropertyWebsitePublish(prop.id, newStatus);
                              if (!res.ok) {
                                setProperties(prev => prev.map(p => p.id === prop.id ? { ...p, publishedToWebsite: !newStatus } : p));
                                setMessage({ type: "error", text: res.message || "Failed to publish." });
                              }
                            }}
                          >
                            {prop.publishedToWebsite ? "✓ Published" : "Publish to Web"}
                          </UIButton>
                          <PropertyStatusDropdown
                            propertyId={prop.id}
                            status={prop.status}
                            onUpdated={(newStatus) => {
                              setProperties((prev) =>
                                prev.map((item) =>
                                  item.id === prop.id ? { ...item, status: newStatus as PropertyRow["status"] } : item,
                                ),
                              );
                            }}
                            onMessage={setMessage}
                          />
                          <Link href={`/portal/properties/${prop.id}/edit`} className="btn btn-secondary property-card-action-btn">
                            Edit
                          </Link>
                          {canClose ? (
                            <UIButton
                              type="button"
                              variant="secondary"
                              className="property-card-action-btn property-card-action-btn-accent"
                              onClick={() => openCloseSale(prop)}
                            >
                              Close Sale
                            </UIButton>
                          ) : null}
                        </div>
                      </div>
                    )}
                  />
                );
              })}
            </div>
          </div>
          {false ? (
          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Address</th>
                  <th>Ref</th>
                  <th>Type</th>
                  <th>Landlord</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((prop) => {
                  const isExpanded = expanded.has(prop.id);
                  const isMultiple = prop.vacancyType === "MULTIPLE";
                  const canClose = prop.status !== "CLOSED" && !isMultiple;

                  return [
                    <tr key={prop.id}>
                      <td style={{ width: "2rem" }}>
                        {isMultiple && (
                          <button
                            onClick={() => toggleExpand(prop.id)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "var(--brand-gold)", fontWeight: 700, fontSize: "1rem",
                            }}
                            title={isExpanded ? "Collapse rooms" : "Expand rooms"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        )}
                      </td>
                      <td>
                        <Link href={`/portal/properties/${prop.id}/edit`} style={{ fontWeight: 600, color: "var(--brand-gold)", display: "block", textDecoration: "none" }}>
                          {prop.addressLine1 || prop.propertyRef}
                        </Link>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {[prop.city, prop.postcode].filter(Boolean).join(", ")}
                        </span>
                      </td>
                      <td>
                        <Link href={`/portal/properties/${prop.id}/edit`} style={{ color: "var(--text-muted)", textDecoration: "none" }}>
                          <code style={{ fontSize: "0.78rem" }}>{prop.propertyRef}</code>
                        </Link>
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        {isMultiple ? "Shared" : (prop.propertyType ?? "Private")}
                        {prop.beds != null && !isMultiple ? ` (${prop.beds}bd)` : ""}
                      </td>
                      <td>
                        <Link href={`/landlords/${prop.landlord.id}`}
                          style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          {prop.landlord.landlordName}
                        </Link>
                      </td>
                      <td>
                        <PropertyStatusDropdown
                          propertyId={prop.id}
                          status={prop.status}
                          onUpdated={(newStatus) => {
                            setProperties((prev) =>
                              prev.map((p) => p.id === prop.id ? { ...p, status: newStatus as PropertyRow["status"] } : p)
                            );
                          }}
                        />
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatDate(prop.createdAt)}</td>
                      <td>
                        <div className="inline-row">
                          <Link className="btn btn-secondary" href={`/portal/properties/${prop.id}/edit`}
                            style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}>
                            Edit
                          </Link>
                          {canClose && (
                            <UIButton
                              variant="secondary"
                              onClick={() => openCloseSale(prop)}
                              style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem", color: "var(--brand-gold)", borderColor: "var(--brand-gold)" }}
                            >
                              Close Sale
                            </UIButton>
                          )}
                          {isMultiple && (
                            <UIButton
                              variant="secondary"
                              onClick={() => toggleExpand(prop.id)}
                              style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                            >
                              {isExpanded ? "Hide Rooms" : "Show Rooms"}
                            </UIButton>
                          )}
                        </div>
                      </td>
                    </tr>,

                    // Expanded rooms rows
                    isExpanded && isMultiple && prop.rooms && prop.rooms.map((room) => (
                      <tr key={`room-${room.id}`} style={{ background: "rgba(255,255,255,0.02)" }}>
                        <td />
                        <td colSpan={3} style={{ paddingLeft: "2.5rem" }}>
                          <span style={{ fontWeight: 500, fontSize: "0.88rem" }}>{room.roomName}</span>
                          {room.sale && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                              → {room.sale.tenant?.fullName ?? "No tenant"} · {money(room.sale.finalAmount)}
                            </span>
                          )}
                        </td>
                        <td colSpan={2}>
                          <span className={`badge ${room.status === "AVAILABLE" ? "badge-active" : room.status === "CLOSED" ? "badge-sold" : "badge-offer"}`} style={{ fontSize: "0.72rem" }}>
                            {room.status}
                          </span>
                          {room.landlordDemand && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>{money(room.landlordDemand)}</span>
                          )}
                        </td>
                        <td />
                        <td>
                          {room.status !== "CLOSED" && (
                            <UIButton
                              variant="secondary"
                              onClick={() => openCloseSale(prop, room.id, room.roomName)}
                              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", color: "var(--brand-gold)", borderColor: "var(--brand-gold)" }}
                            >
                              Close Sale
                            </UIButton>
                          )}
                        </td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
          ) : null}
          </>
        )}

        {!loading && total > 0 ? (
          <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
            <PaginationControls
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              busy={loading}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </div>
        ) : null}
      </div>

      {/* Close-Sale Modal */}
      {closeSale && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem",
            padding: "1.75rem", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>Close Sale</h2>
              <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {closeSale.address}{closeSale.roomName ? ` — ${closeSale.roomName}` : ""}
              </p>
            </div>

            {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

            <div className="field-grid" style={{ marginTop: "0.75rem" }}>
              <div className="form-section-divider"><span className="form-section-label">Sale Details</span></div>

              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Final Amount (£) <span style={{ color: "var(--danger)" }}>*</span></span>
                  <UIInput type="number" min={0} step="0.01" value={saleForm.finalAmount}
                    onChange={(e) => setSaleForm((p) => ({ ...p, finalAmount: e.target.value }))}
                    placeholder="e.g. 1200" disabled={closeBusy} />
                </label>
                <label className="field">
                  <span className="label">Commission % <span style={{ color: "var(--danger)" }}>*</span></span>
                  <UIInput type="number" min={0} max={100} step="0.1" value={saleForm.commissionPct}
                    onChange={(e) => setSaleForm((p) => ({ ...p, commissionPct: e.target.value }))}
                    placeholder="e.g. 10" disabled={closeBusy} />
                </label>
              </div>

              <label className="field">
                <span className="label">Other Costs (£) (optional)</span>
                <UIInput type="number" min={0} step="0.01" value={saleForm.otherCosts}
                  onChange={(e) => setSaleForm((p) => ({ ...p, otherCosts: e.target.value }))}
                  placeholder="e.g. 50" disabled={closeBusy} />
              </label>

              <div className="form-section-divider"><span className="form-section-label">Tenant Details</span></div>

              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Full Name <span style={{ color: "var(--danger)" }}>*</span></span>
                  <UIInput value={tenantForm.fullName} onChange={(e) => setTenantForm((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Jane Doe" disabled={closeBusy} />
                </label>
                <label className="field">
                  <span className="label">Phone <span style={{ color: "var(--danger)" }}>*</span></span>
                  <UIInput value={tenantForm.phone} onChange={(e) => setTenantForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="07911 122233" disabled={closeBusy} />
                </label>
              </div>

              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Email (optional)</span>
                  <UIInput type="email" value={tenantForm.email} onChange={(e) => setTenantForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="jane@example.com" disabled={closeBusy} />
                </label>
                <label className="field">
                  <span className="label">Current Address (optional)</span>
                  <UIInput value={tenantForm.currentAddress} onChange={(e) => setTenantForm((p) => ({ ...p, currentAddress: e.target.value }))}
                    placeholder="123 Old Road..." disabled={closeBusy} />
                </label>
              </div>

              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Move-In Date (optional)</span>
                  <UIInput type="date" value={tenantForm.moveInDate} onChange={(e) => setTenantForm((p) => ({ ...p, moveInDate: e.target.value }))} disabled={closeBusy} />
                </label>
                <label className="field">
                  <span className="label">Monthly Rent (£) (optional)</span>
                  <UIInput type="number" min={0} step="0.01" value={tenantForm.rentAmount}
                    onChange={(e) => setTenantForm((p) => ({ ...p, rentAmount: e.target.value }))}
                    placeholder="e.g. 900" disabled={closeBusy} />
                </label>
              </div>

              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Deposit (£) (optional)</span>
                  <UIInput type="number" min={0} step="0.01" value={tenantForm.depositAmount}
                    onChange={(e) => setTenantForm((p) => ({ ...p, depositAmount: e.target.value }))}
                    placeholder="e.g. 1200" disabled={closeBusy} />
                </label>
                <label className="field">
                  <span className="label">Notes (optional)</span>
                  <UIInput value={tenantForm.notes} onChange={(e) => setTenantForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="..." disabled={closeBusy} />
                </label>
              </div>

              <div className="inline-row" style={{ marginTop: "0.5rem" }}>
                <UIButton onClick={() => void handleCloseSale()} disabled={closeBusy}>
                  {closeBusy ? "Closing Sale..." : "Confirm Close Sale"}
                </UIButton>
                <UIButton variant="secondary" onClick={() => { setCloseSale(null); setMessage(null); }} disabled={closeBusy}>
                  Cancel
                </UIButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
