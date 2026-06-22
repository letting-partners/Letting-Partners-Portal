"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";

type PotentialLandlord = {
  id: string;
  fullName: string;
  phone: string;
  phoneLast10: string;
  email: string | null;
  createdAt: string;
  followUpScheduledAt: string | null;
  followUpLockedUntil: string | null;
  isFollowUpLocked: boolean;
  addedByAgent: { id: string; agentDisplayName: string };
};

type Props = {
  initialLandlords: PotentialLandlord[];
  currentUserId: string;
};

function getLockStatus(lead: PotentialLandlord): { locked: boolean; until: Date | null } {
  if (!lead.isFollowUpLocked || !lead.followUpLockedUntil) return { locked: false, until: null };
  const until = new Date(lead.followUpLockedUntil);
  return { locked: until > new Date(), until };
}

export function PotentialLandlordsClient({ initialLandlords, currentUserId }: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLandlords);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reschedule modal
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // 3-dot menu
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Not-interested busy tracking
  const [notInterestedBusy, setNotInterestedBusy] = useState<string | null>(null);

  const filtered = leads.filter((l) => {
    const haystack = [l.fullName, l.phone, l.phoneLast10, l.email ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const totalPages = filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const minDate = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 10);
  })();

  function openReschedule(id: string) {
    setRescheduleId(id);
    setRescheduleDate("");
    setRescheduleTime("");
    setRescheduleError(null);
    setMenuId(null);
    setMenuPos(null);
  }

  async function submitReschedule() {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) return;
    setRescheduleBusy(true);
    setRescheduleError(null);

    const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString();

    try {
      const res = await fetch(`/api/potential-landlords/${rescheduleId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRescheduleError(data.error ?? "Failed to reschedule.");
        return;
      }
      setLeads((prev) =>
        prev.map((l) =>
          l.id === rescheduleId
            ? { ...l, followUpScheduledAt: data.followUpScheduledAt, isFollowUpLocked: true }
            : l,
        ),
      );
      setRescheduleId(null);
    } catch {
      setRescheduleError("Network error. Please try again.");
    } finally {
      setRescheduleBusy(false);
    }
  }

  async function handleNotInterested(lead: PotentialLandlord) {
    if (!confirm(`Mark "${lead.fullName}" as not interested and remove from your list?`)) return;
    setNotInterestedBusy(lead.id);
    setMenuId(null);
    setMenuPos(null);

    try {
      const res = await fetch(`/api/potential-landlords/${lead.id}/not-interested`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      }
    } finally {
      setNotInterestedBusy(null);
    }
  }

  function handleInterested(lead: PotentialLandlord) {
    const parts = lead.fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || firstName;
    const params = new URLSearchParams({ phone: lead.phone, firstName, lastName });
    if (lead.email) params.set("email", lead.email);
    router.push(`/portal/properties/add?${params.toString()}`);
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">My Follow-Up Leads</h1>
          <p className="page-subtitle">
            {leads.length} potential {leads.length === 1 ? "landlord" : "landlords"} · Use the dashboard phone lookup to add new ones
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-secondary">
          ← Dashboard
        </Link>
      </header>

      <div className="panel" style={{ padding: "1rem 1.25rem" }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="label">Search</span>
          <UIInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name, phone, email"
          />
        </label>
      </div>

      <div className="panel">
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
            Follow-Up Leads
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            {leads.length === 0
              ? "No follow-up leads yet."
              : "No leads match your search."}
            <br />
            <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
              {leads.length === 0
                ? "Look up a phone number on the dashboard to start the workflow."
                : "Try a different search term."}
            </span>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Follow-Up</th>
                  <th>Lock Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => {
                  const { locked, until } = getLockStatus(l);
                  const isNIBusy = notInterestedBusy === l.id;
                  return (
                    <tr key={l.id} style={isNIBusy ? { opacity: 0.5, pointerEvents: "none" } : {}}>
                      <td style={{ fontWeight: 600, color: "var(--text)" }}>
                        <Link
                          href={`/potential-landlords/${l.id}`}
                          style={{ color: "var(--brand-gold)", textDecoration: "none" }}
                        >
                          {l.fullName}
                        </Link>
                        {l.email && (
                          <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>
                            {l.email}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        {l.phone}
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {l.followUpScheduledAt ? (
                          <span style={{ color: "var(--text)" }}>
                            {new Date(l.followUpScheduledAt).toLocaleString("en-GB", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td>
                        {locked ? (
                          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#4ade80", background: "rgba(74,222,128,0.1)", padding: "0.2rem 0.5rem", borderRadius: "0.3rem", whiteSpace: "nowrap" }}>
                            Locked · until{" "}
                            {until!.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "0.2rem 0.5rem", borderRadius: "0.3rem" }}>
                            Unlocked
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {new Date(l.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                      <td>
                        <div className="inline-row" style={{ gap: "0.4rem" }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                            onClick={() => openReschedule(l.id)}
                          >
                            Reschedule
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                            onClick={() => handleInterested(l)}
                          >
                            Interested
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "1.1rem", lineHeight: 1 }}
                          title="More options"
                          onClick={(e) => {
                            if (menuId === l.id) { setMenuId(null); setMenuPos(null); return; }
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            setMenuId(l.id);
                          }}
                        >
                          ⋮
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      {/* 3-dot dropdown */}
      {menuId && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: "fixed", top: menuPos.top, right: menuPos.right,
            zIndex: 300, background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "8px", boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            minWidth: "150px", overflow: "hidden",
          }}
        >
          {(() => {
            const lead = leads.find((l) => l.id === menuId);
            if (!lead) return null;
            return (
              <button
                style={{
                  display: "block", width: "100%", padding: "0.65rem 1rem",
                  background: "none", border: "none", textAlign: "left",
                  cursor: "pointer", color: "var(--danger)", fontSize: "0.85rem",
                }}
                onClick={() => void handleNotInterested(lead)}
              >
                Not Interested
              </button>
            );
          })()}
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduleId && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 400, padding: "1.5rem",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setRescheduleId(null); }}
        >
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "12px", padding: "1.5rem", width: "100%", maxWidth: "380px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>Reschedule Follow-Up</p>
              <button
                onClick={() => setRescheduleId(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem" }}
              >
                ✕
              </button>
            </div>
            {rescheduleError && (
              <p style={{ color: "var(--danger)", fontSize: "0.82rem", marginBottom: "0.75rem" }}>{rescheduleError}</p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1rem" }}>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Date</span>
                <input className="input" type="date" min={minDate} value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} disabled={rescheduleBusy} />
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Time</span>
                <input className="input" type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} disabled={rescheduleBusy} />
              </label>
            </div>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                className="btn btn-primary"
                disabled={!rescheduleDate || !rescheduleTime || rescheduleBusy}
                onClick={() => void submitReschedule()}
              >
                {rescheduleBusy ? "Saving…" : "Confirm Reschedule"}
              </button>
              <button className="btn btn-secondary" onClick={() => setRescheduleId(null)} disabled={rescheduleBusy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
