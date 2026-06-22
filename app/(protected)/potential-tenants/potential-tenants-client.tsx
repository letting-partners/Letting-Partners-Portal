"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";

type PotentialTenant = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  interestedIn: string | null;
  budget: string | null;
  accommodationType: string | null;
  maximumBudget: number | null;
  moveInDate: string | null;
  notes: string | null;
  createdAt: string;
  addedByAgent: { id: string; agentDisplayName: string };
};

type Props = {
  initialTenants: PotentialTenant[];
};

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  accommodationType: "" as "PRIVATE" | "SHARED" | "",
  tenantRoomType: "",
  interestedIn: "",
  moveInDate: "",
  moveInFlexible: false,
  maximumBudget: "",
  currentLivingPostcode: "",
  workplacePostcode: "",
  numberOfOccupants: "",
  numberOfChildren: "",
  onDSS: false,
  currentlyEmployed: false,
  annualIncome: "",
  workingProfession: "",
  immigrationStatus: "",
  nationality: "",
  countryOriginal: "",
  notes: "",
};

const ROOM_TYPE_OPTIONS = [
  { value: "STUDIO_ROOM", label: "Studio Room" },
  { value: "SINGLE_ROOM", label: "Single Room" },
  { value: "DOUBLE_ROOM", label: "Double Room" },
  { value: "ENSUITE_ROOM", label: "En-Suite Room" },
  { value: "LOFT", label: "Loft" },
];

const IMMIGRATION_STATUS_OPTIONS = [
  "British Citizen",
  "Settled Status (ILR)",
  "Pre-Settled Status",
  "Student Visa",
  "Skilled Worker Visa",
  "Family Visa",
  "Refugee / Asylum",
  "Other",
];

export function PotentialTenantsClient({ initialTenants }: Props) {
  const router = useRouter();
  const [tenants, setTenants] = useState(initialTenants);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = tenants.filter((t) => {
    const haystack = [t.fullName, t.email, t.phone, t.interestedIn, t.budget, t.accommodationType]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const totalPages = filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function field<K extends keyof typeof form>(key: K) {
    return {
      value: form[key] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  function check(key: "onDSS" | "currentlyEmployed" | "moveInFlexible") {
    return {
      checked: form[key] as boolean,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.checked })),
    };
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!firstName || !lastName) {
      setError("First and last name are required.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          accommodationType: form.accommodationType || undefined,
          tenantRoomType: form.tenantRoomType || undefined,
          interestedIn: form.interestedIn.trim() || undefined,
          moveInDate: form.moveInDate || undefined,
          moveInFlexible: form.moveInFlexible,
          maximumBudget: form.maximumBudget ? Number(form.maximumBudget) : undefined,
          currentLivingPostcode: form.currentLivingPostcode.toUpperCase() || undefined,
          workplacePostcode: form.workplacePostcode.toUpperCase() || undefined,
          numberOfOccupants: form.numberOfOccupants ? Number(form.numberOfOccupants) : undefined,
          numberOfChildren: form.numberOfChildren ? Number(form.numberOfChildren) : undefined,
          onDSS: form.onDSS,
          currentlyEmployed: form.currentlyEmployed,
          annualIncome: form.annualIncome ? Number(form.annualIncome) : undefined,
          workingProfession: form.workingProfession.trim() || undefined,
          immigrationStatus: form.immigrationStatus || undefined,
          nationality: form.nationality.trim() || undefined,
          countryOriginal: form.countryOriginal.trim() || undefined,
          notes: form.notes.trim() || undefined,
        };

        const res = await fetch("/api/potential-tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message ?? data.error ?? "Failed to add potential tenant.");
          return;
        }

        const data = await res.json();
        setTenants((prev) => [
          {
            ...data.potentialTenant,
            createdAt: data.potentialTenant.createdAt ?? new Date().toISOString(),
            addedByAgent: { id: "", agentDisplayName: "You" },
          },
          ...prev,
        ]);
        setPage(1);
        setShowModal(false);
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Potential Tenants</h1>
          <p className="page-subtitle">
            {tenants.length} potential {tenants.length === 1 ? "tenant" : "tenants"} in your pipeline
          </p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          + Add Potential Tenant
        </button>
      </header>

      <div className="panel" style={{ padding: "1rem 1.25rem" }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="label">Search</span>
          <UIInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name, phone, email, accommodation type"
          />
        </label>
      </div>

      <div className="panel">
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
            All Potential Tenants
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            {tenants.length === 0 ? "No potential tenants yet." : "No tenants match your search."}
            <br />
            <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
              {tenants.length === 0 ? 'Click "+ Add Potential Tenant" to get started.' : "Try a different search term."}
            </span>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Max Budget</th>
                  <th>Move-In</th>
                  <th>Date Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={`/potential-tenants/${t.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                        {t.fullName}
                      </Link>
                      {t.interestedIn && (
                        <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>
                          {t.interestedIn}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {t.email && <span style={{ display: "block" }}>{t.email}</span>}
                      {t.phone && <span>{t.phone}</span>}
                      {!t.email && !t.phone && <span>—</span>}
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>
                      {t.accommodationType ? (
                        <span className={`badge ${t.accommodationType === "PRIVATE" ? "badge-active" : "badge-passive"}`}>
                          {t.accommodationType === "PRIVATE" ? "Private" : "Shared"}
                        </span>
                      ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      {t.maximumBudget ? `£${Number(t.maximumBudget).toLocaleString("en-GB")}/mo` : "—"}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {t.moveInDate
                        ? new Date(t.moveInDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td>
                      <Link
                        href={`/potential-tenants/${t.id}`}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.78rem", padding: "0.3rem 0.75rem" }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
            <PaginationControls
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(next) => { setPageSize(next); setPage(1); }}
            />
          </div>
        )}
      </div>

      {/* ── Add Potential Tenant Modal ── */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: "2rem 1rem",
            overflowY: "auto",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "0.75rem", padding: "1.75rem",
              width: "100%", maxWidth: "640px",
              display: "flex", flexDirection: "column", gap: "0", marginTop: "auto", marginBottom: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
                Add Potential Tenant
              </h2>
              <button
                onClick={closeModal}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.25rem" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* Personal Details */}
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Personal Details
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">First Name *</span>
                  <input className="input" {...field("firstName")} placeholder="Jane" required />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Last Name *</span>
                  <input className="input" {...field("lastName")} placeholder="Smith" required />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Email</span>
                  <input className="input" type="email" {...field("email")} placeholder="jane@example.com" />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Phone</span>
                  <input className="input" type="tel" {...field("phone")} placeholder="+44 7700 900000" />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Nationality</span>
                  <input className="input" {...field("nationality")} placeholder="British" />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Country of Origin</span>
                  <input className="input" {...field("countryOriginal")} placeholder="United Kingdom" />
                </label>
              </div>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Immigration Status</span>
                <select className="input" {...field("immigrationStatus")}>
                  <option value="">— Select —</option>
                  {IMMIGRATION_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              {/* Accommodation Requirements */}
              <p style={{ margin: "0.5rem 0 0.25rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Accommodation Requirements
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Accommodation Type</span>
                  <select className="input" value={form.accommodationType} onChange={(e) => setForm((f) => ({ ...f, accommodationType: e.target.value as any }))}>
                    <option value="">— Select —</option>
                    <option value="PRIVATE">Private</option>
                    <option value="SHARED">Shared</option>
                  </select>
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Room Type</span>
                  <select className="input" {...field("tenantRoomType")}>
                    <option value="">— Select —</option>
                    {ROOM_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Interested In (area / description)</span>
                <input className="input" {...field("interestedIn")} placeholder="e.g. 2-bed flat in Manchester" />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Max Budget (£/mo)</span>
                  <input className="input" type="number" min={0} {...field("maximumBudget")} placeholder="800" />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Move-In Date</span>
                  <input className="input" type="date" {...field("moveInDate")} />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Current Living Postcode</span>
                  <input
                    className="input"
                    value={form.currentLivingPostcode}
                    onChange={(e) => setForm((f) => ({ ...f, currentLivingPostcode: e.target.value.toUpperCase() }))}
                    placeholder="M1 1AB"
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Workplace Postcode</span>
                  <input
                    className="input"
                    value={form.workplacePostcode}
                    onChange={(e) => setForm((f) => ({ ...f, workplacePostcode: e.target.value.toUpperCase() }))}
                    placeholder="M2 3BC"
                  />
                </label>
              </div>

              {/* Household */}
              <p style={{ margin: "0.5rem 0 0.25rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Household
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Number of Occupants</span>
                  <input className="input" type="number" min={1} {...field("numberOfOccupants")} placeholder="1" />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Number of Children</span>
                  <input className="input" type="number" min={0} {...field("numberOfChildren")} placeholder="0" />
                </label>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: "var(--text)" }}>
                  <input type="checkbox" {...check("onDSS")} />
                  On DSS / Benefits
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: "var(--text)" }}>
                  <input type="checkbox" {...check("moveInFlexible")} />
                  Move-In Flexible
                </label>
              </div>

              {/* Employment */}
              <p style={{ margin: "0.5rem 0 0.25rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Employment
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: "var(--text)" }}>
                <input type="checkbox" {...check("currentlyEmployed")} id="currentlyEmployed" />
                <label htmlFor="currentlyEmployed" style={{ cursor: "pointer" }}>Currently Employed</label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Working Profession</span>
                  <input className="input" {...field("workingProfession")} placeholder="Software Engineer" />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Annual Income (£)</span>
                  <input className="input" type="number" min={0} {...field("annualIncome")} placeholder="30000" />
                </label>
              </div>

              {/* Notes */}
              <p style={{ margin: "0.5rem 0 0.25rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Notes
              </p>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Additional Notes</span>
                <textarea className="input" rows={3} {...field("notes")} placeholder="Any additional details…" style={{ resize: "vertical" }} />
              </label>

              {error && (
                <p style={{ margin: 0, color: "#f87171", fontSize: "0.82rem" }}>{error}</p>
              )}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Add Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
