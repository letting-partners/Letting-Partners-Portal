"use client";

import { useEffect, useRef, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { checkLandlordNumber, createLandlord, createTenant } from "@/lib/portal-api";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallRecord = {
  id: string;
  phoneNumber: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  convertedToLandlordId: string | null;
  convertedToTenantId: string | null;
  convertedLandlord: { id: string; landlordName: string } | null;
  convertedTenant: { id: string; fullName: string } | null;
};

type ScheduledCall = {
  id: string;
  phoneNumber: string;
  contactName: string | null;
  scheduledAt: string;
  notes: string | null;
  status: "PENDING" | "DONE" | "CANCELLED" | "MISSED";
  createdAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  CONNECTED: "Connected",
  FAILED: "Failed",
  NO_ANSWER: "No Answer",
  FOLLOW_UP: "Follow Up",
  RESCHEDULED: "Rescheduled",
  VOICEMAIL: "Voicemail",
};

const STATUS_COLORS: Record<string, string> = {
  CONNECTED: "#4ade80",
  FAILED: "var(--danger)",
  NO_ANSWER: "var(--text-muted)",
  FOLLOW_UP: "var(--brand-gold)",
  RESCHEDULED: "#60a5fa",
  VOICEMAIL: "#a78bfa",
};

const SCHED_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DONE: "Done",
  CANCELLED: "Cancelled",
  MISSED: "Missed",
};

const SCHED_STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--brand-gold)",
  DONE: "#4ade80",
  CANCELLED: "var(--text-muted)",
  MISSED: "var(--danger)",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS);

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtScheduled(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function isOverdue(dateStr: string, status: string) {
  return status === "PENDING" && new Date(dateStr) < new Date();
}

function isDueSoon(dateStr: string, status: string) {
  if (status !== "PENDING") return false;
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 && diff < 60 * 60 * 1000; // within 1 hour
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CallRecordsPage() {
  const [activeTab, setActiveTab] = useState<"records" | "scheduled">("records");

  // ── Call Records State ──
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const [editStatusId, setEditStatusId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Add Landlord modal
  const [landlordModal, setLandlordModal] = useState<{ recordId: string; phone: string } | null>(null);
  const [llName, setLlName] = useState("");
  const [llEmail, setLlEmail] = useState("");
  const [llNotes, setLlNotes] = useState("");
  const [llChecking, setLlChecking] = useState(false);
  const [llChecked, setLlChecked] = useState(false);
  const [llConflict, setLlConflict] = useState<string | null>(null);
  const [llBusy, setLlBusy] = useState(false);
  const [llMsg, setLlMsg] = useState<string | null>(null);

  // Add Tenant modal
  const [tenantModal, setTenantModal] = useState<{ recordId: string; phone: string } | null>(null);
  const [tnName, setTnName] = useState("");
  const [tnEmail, setTnEmail] = useState("");
  const [tnNotes, setTnNotes] = useState("");
  const [tnBusy, setTnBusy] = useState(false);
  const [tnMsg, setTnMsg] = useState<string | null>(null);

  // ── Scheduled Calls State ──
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [schedLoading, setSchedLoading] = useState(true);
  const [schedMessage, setSchedMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const [showSchedAdd, setShowSchedAdd] = useState(false);
  const [schedPhone, setSchedPhone] = useState("");
  const [schedContact, setSchedContact] = useState("");
  const [schedAt, setSchedAt] = useState("");
  const [schedNotes, setSchedNotes] = useState("");
  const [schedBusy, setSchedBusy] = useState(false);

  const [editSched, setEditSched] = useState<ScheduledCall | null>(null);
  const [editSchedPhone, setEditSchedPhone] = useState("");
  const [editSchedContact, setEditSchedContact] = useState("");
  const [editSchedAt, setEditSchedAt] = useState("");
  const [editSchedNotes, setEditSchedNotes] = useState("");
  const [editSchedStatus, setEditSchedStatus] = useState("PENDING");
  const [editSchedBusy, setEditSchedBusy] = useState(false);

  // ── Load Data ──

  async function loadRecords() {
    setRecordsLoading(true);
    const result = await apiGet<{ records: CallRecord[] }>("/api/call-records");
    setRecordsLoading(false);
    if (!result.ok) { setMessage({ type: "error", text: result.message ?? "Failed to load call records." }); return; }
    setRecords(result.data.records);
  }

  async function loadScheduled() {
    setSchedLoading(true);
    const result = await apiGet<{ calls: ScheduledCall[] }>("/api/scheduled-calls");
    setSchedLoading(false);
    if (!result.ok) { setSchedMessage({ type: "error", text: result.message ?? "Failed to load scheduled calls." }); return; }
    setScheduledCalls(result.data.calls);
  }

  useEffect(() => { void loadRecords(); void loadScheduled(); }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
        setMenuPos(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Call Records Actions ──

  async function saveStatus(id: string) {
    setEditBusy(true);
    const result = await apiPatch<object, { record: CallRecord }>(`/api/call-records/${id}`, { status: editStatus });
    setEditBusy(false);
    if (!result.ok) { setMessage({ type: "error", text: result.message ?? "Failed to update status." }); return; }
    setEditStatusId(null);
    await loadRecords();
  }

  async function handleDeleteRecord(id: string) {
    if (!confirm("Delete this call record?")) return;
    const result = await apiDelete(`/api/call-records/${id}`);
    if (!result.ok) { setMessage({ type: "error", text: result.message ?? "Failed to delete." }); return; }
    setMenuOpenId(null);
    setMessage({ type: "success", text: "Call record deleted." });
    await loadRecords();
  }

  function openLandlordModal(record: CallRecord) {
    setMenuOpenId(null);
    setLandlordModal({ recordId: record.id, phone: record.phoneNumber });
    setLlName(""); setLlEmail(""); setLlNotes(""); setLlChecked(false); setLlConflict(null); setLlMsg(null);
  }

  async function checkLlPhone(phone: string) {
    if (!phone.trim()) return;
    setLlChecking(true); setLlConflict(null); setLlChecked(false); setLlMsg(null);
    const result = await checkLandlordNumber(phone.trim());
    setLlChecking(false);
    if (!result.ok) { setLlMsg("Could not verify phone number."); return; }
    if (result.data.landlordExists) {
      const ll = result.data.landlord;
      setLlConflict(`Already exists: ${ll?.landlordName} (${ll?.ownerAgent?.agentDisplayName ?? "another agent"}).`);
      return;
    }
    setLlChecked(true); setLlMsg("Phone available.");
  }

  async function handleAddLandlord() {
    if (!landlordModal || !llName.trim()) return;
    setLlBusy(true);
    const result = await createLandlord({ fullName: llName.trim(), phone: landlordModal.phone, email: llEmail.trim() || undefined, notes: llNotes.trim() || undefined });
    if (!result.ok) { setLlMsg(result.message ?? "Failed to create landlord."); setLlBusy(false); return; }
    await apiPatch(`/api/call-records/${landlordModal.recordId}`, { convertedToLandlordId: result.data.landlord.id });
    setLlBusy(false); setLandlordModal(null);
    setMessage({ type: "success", text: `Landlord "${result.data.landlord.landlordName}" created and linked.` });
    await loadRecords();
  }

  function openTenantModal(record: CallRecord) {
    setMenuOpenId(null);
    setTenantModal({ recordId: record.id, phone: record.phoneNumber });
    setTnName(""); setTnEmail(""); setTnNotes(""); setTnMsg(null);
  }

  async function handleAddTenant() {
    if (!tenantModal || !tnName.trim()) { setTnMsg("Full name is required."); return; }
    setTnBusy(true);
    const result = await createTenant({ fullName: tnName.trim(), phone: tenantModal.phone, email: tnEmail.trim() || null, notes: tnNotes.trim() || null });
    if (!result.ok) { setTnMsg(result.message ?? "Failed to create tenant."); setTnBusy(false); return; }
    await apiPatch(`/api/call-records/${tenantModal.recordId}`, { convertedToTenantId: result.data.tenant.id });
    setTnBusy(false); setTenantModal(null);
    setMessage({ type: "success", text: `Tenant "${result.data.tenant.fullName}" created and linked.` });
    await loadRecords();
  }

  // ── Scheduled Calls Actions ──

  async function handleSchedAdd() {
    if (!schedPhone.trim()) { setSchedMessage({ type: "error", text: "Phone number is required." }); return; }
    if (!schedAt) { setSchedMessage({ type: "error", text: "Scheduled date & time is required." }); return; }
    setSchedBusy(true); setSchedMessage(null);
    const result = await apiPost<object, { call: ScheduledCall }>("/api/scheduled-calls", {
      phoneNumber: schedPhone.trim(),
      contactName: schedContact.trim() || null,
      scheduledAt: new Date(schedAt).toISOString(),
      notes: schedNotes.trim() || null,
    });
    setSchedBusy(false);
    if (!result.ok) { setSchedMessage({ type: "error", text: result.message ?? "Failed to schedule call." }); return; }
    setSchedMessage({ type: "success", text: "Call scheduled." });
    setShowSchedAdd(false); setSchedPhone(""); setSchedContact(""); setSchedAt(""); setSchedNotes("");
    await loadScheduled();
  }

  function openEditSched(call: ScheduledCall) {
    setEditSched(call);
    setEditSchedPhone(call.phoneNumber);
    setEditSchedContact(call.contactName ?? "");
    // Convert ISO to local datetime-local format
    const d = new Date(call.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditSchedAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setEditSchedNotes(call.notes ?? "");
    setEditSchedStatus(call.status);
  }

  async function handleSchedUpdate() {
    if (!editSched) return;
    if (!editSchedPhone.trim()) { setSchedMessage({ type: "error", text: "Phone number is required." }); return; }
    if (!editSchedAt) { setSchedMessage({ type: "error", text: "Scheduled date & time is required." }); return; }
    setEditSchedBusy(true); setSchedMessage(null);
    const result = await apiPatch<object, { call: ScheduledCall }>(`/api/scheduled-calls/${editSched.id}`, {
      contactName: editSchedContact.trim() || null,
      scheduledAt: new Date(editSchedAt).toISOString(),
      notes: editSchedNotes.trim() || null,
      status: editSchedStatus,
    });
    setEditSchedBusy(false);
    if (!result.ok) { setSchedMessage({ type: "error", text: result.message ?? "Failed to update." }); return; }
    setEditSched(null);
    setSchedMessage({ type: "success", text: "Scheduled call updated." });
    await loadScheduled();
  }

  async function handleSchedDelete(id: string) {
    if (!confirm("Delete this scheduled call?")) return;
    const result = await apiDelete(`/api/scheduled-calls/${id}`);
    if (!result.ok) { setSchedMessage({ type: "error", text: result.message ?? "Failed to delete." }); return; }
    setSchedMessage({ type: "success", text: "Deleted." });
    await loadScheduled();
  }

  async function markSchedDone(id: string) {
    await apiPatch(`/api/scheduled-calls/${id}`, { status: "DONE" });
    await loadScheduled();
  }

  // ── Overdue/upcoming alerts ──
  const overdueCount = scheduledCalls.filter((c) => isOverdue(c.scheduledAt, c.status)).length;
  const dueSoonCount = scheduledCalls.filter((c) => isDueSoon(c.scheduledAt, c.status)).length;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Call Records</h1>
          <p className="page-subtitle">
            {records.length} call{records.length !== 1 ? "s" : ""} logged
            {scheduledCalls.filter((c) => c.status === "PENDING").length > 0 && (
              <> · <span style={{ color: "var(--brand-gold)" }}>
                {scheduledCalls.filter((c) => c.status === "PENDING").length} scheduled
              </span></>
            )}
          </p>
        </div>
        {activeTab === "scheduled" && (
          <UIButton onClick={() => { setShowSchedAdd((v) => !v); setSchedMessage(null); }}>
            {showSchedAdd ? "Cancel" : "+ Schedule a Call"}
          </UIButton>
        )}
      </header>

      {/* Overdue / due-soon alerts banner */}
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div style={{
          display: "flex", gap: "0.75rem", flexWrap: "wrap",
        }}>
          {overdueCount > 0 && (
            <div style={{
              background: "#ef444422", border: "1px solid #ef444466",
              borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.85rem",
              color: "#ef4444", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <span>⚠</span>
              <span><strong>{overdueCount}</strong> overdue scheduled call{overdueCount !== 1 ? "s" : ""} — check the Scheduled tab</span>
            </div>
          )}
          {dueSoonCount > 0 && (
            <div style={{
              background: "#c69a4b22", border: "1px solid #c69a4b66",
              borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.85rem",
              color: "var(--brand-gold)", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <span>🔔</span>
              <span><strong>{dueSoonCount}</strong> call{dueSoonCount !== 1 ? "s" : ""} due within the hour</span>
            </div>
          )}
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
        {(["records", "scheduled"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--brand-gold)" : "2px solid transparent",
              color: activeTab === tab ? "var(--brand-gold)" : "var(--text-muted)",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 700 : 400,
              fontSize: "0.9rem",
              padding: "0.65rem 1.25rem",
              marginBottom: "-1px",
              transition: "color 0.15s",
            }}
          >
            {tab === "records" ? "Call Records" : (
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                Scheduled
                {scheduledCalls.filter((c) => c.status === "PENDING").length > 0 && (
                  <span style={{
                    background: "var(--brand-gold)", color: "#080810",
                    borderRadius: "99px", fontSize: "0.7rem", fontWeight: 700,
                    padding: "0.1rem 0.45rem", lineHeight: 1.4,
                  }}>
                    {scheduledCalls.filter((c) => c.status === "PENDING").length}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ CALL RECORDS TAB ══════════════ */}
      {activeTab === "records" && (
        <>
          {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

          <div className="panel">
            <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>All Calls</h2>
            </div>
            {recordsLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</div>
            ) : records.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>No call records yet.</div>
            ) : (
              <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th>Linked To</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => {
                      const editingStatus = editStatusId === rec.id;
                      return (
                        <tr key={rec.id}>
                          <td style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.9rem" }}>{rec.phoneNumber}</td>
                          <td>
                            {editingStatus ? (
                              <div className="inline-row" style={{ gap: "0.4rem" }}>
                                <select className="input" style={{ padding: "0.3rem 0.5rem", fontSize: "0.82rem" }} value={editStatus} onChange={(e) => setEditStatus(e.target.value)} disabled={editBusy}>
                                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                                </select>
                                <UIButton onClick={() => void saveStatus(rec.id)} disabled={editBusy}>{editBusy ? "..." : "Save"}</UIButton>
                                <UIButton variant="secondary" onClick={() => setEditStatusId(null)} disabled={editBusy}>✕</UIButton>
                              </div>
                            ) : (
                              <span
                                className="badge"
                                style={{ background: `${STATUS_COLORS[rec.status] ?? "var(--text-muted)"}22`, color: STATUS_COLORS[rec.status] ?? "var(--text-muted)", border: `1px solid ${STATUS_COLORS[rec.status] ?? "var(--text-muted)"}44`, cursor: "pointer" }}
                                onClick={() => { setEditStatusId(rec.id); setEditStatus(rec.status); }}
                                title="Click to change status"
                              >
                                {STATUS_LABELS[rec.status] ?? rec.status}
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: "14rem" }}>
                            {rec.notes ? <span title={rec.notes}>{rec.notes.length > 50 ? rec.notes.slice(0, 50) + "…" : rec.notes}</span> : "—"}
                          </td>
                          <td style={{ fontSize: "0.82rem" }}>
                            {rec.convertedLandlord ? (
                              <span style={{ color: "var(--brand-gold)" }}>Landlord: {rec.convertedLandlord.landlordName}</span>
                            ) : rec.convertedTenant ? (
                              <span style={{ color: "#4ade80" }}>Tenant: {rec.convertedTenant.fullName}</span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                          <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmt(rec.createdAt)}</td>
                          <td>
                            <button
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "1.1rem", lineHeight: 1 }}
                              title="More options"
                              onClick={(e) => {
                                if (menuOpenId === rec.id) { setMenuOpenId(null); setMenuPos(null); return; }
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setMenuOpenId(rec.id);
                              }}
                            >⋮</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ SCHEDULED CALLS TAB ══════════════ */}
      {activeTab === "scheduled" && (
        <>
          {schedMessage && <UIAlert type={schedMessage.type}>{schedMessage.text}</UIAlert>}

          {showSchedAdd && (
            <div className="panel" style={{ padding: "1.25rem" }}>
              <p className="section-label" style={{ marginBottom: "1rem" }}>Schedule New Call</p>
              <div className="field-grid">
                <div className="field-grid-2">
                  <label className="field">
                    <span className="label">Phone Number <span style={{ color: "var(--danger)" }}>*</span></span>
                    <UIInput value={schedPhone} onChange={(e) => setSchedPhone(e.target.value)} placeholder="07911 122233" disabled={schedBusy} />
                  </label>
                  <label className="field">
                    <span className="label">Contact Name (optional)</span>
                    <UIInput value={schedContact} onChange={(e) => setSchedContact(e.target.value)} placeholder="e.g. John Smith" disabled={schedBusy} />
                  </label>
                </div>
                <label className="field">
                  <span className="label">Date & Time <span style={{ color: "var(--danger)" }}>*</span></span>
                  <input
                    type="datetime-local"
                    className="input"
                    value={schedAt}
                    onChange={(e) => setSchedAt(e.target.value)}
                    disabled={schedBusy}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </label>
                <label className="field">
                  <span className="label">Notes (optional)</span>
                  <UIInput value={schedNotes} onChange={(e) => setSchedNotes(e.target.value)} placeholder="Purpose or context for this call..." disabled={schedBusy} />
                </label>
                <div className="inline-row">
                  <UIButton onClick={() => void handleSchedAdd()} disabled={schedBusy}>{schedBusy ? "Saving..." : "Schedule Call"}</UIButton>
                  <UIButton variant="secondary" onClick={() => { setShowSchedAdd(false); setSchedPhone(""); setSchedContact(""); setSchedAt(""); setSchedNotes(""); }}>Cancel</UIButton>
                </div>
              </div>
            </div>
          )}

          <div className="panel">
            <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>Scheduled Calls</h2>
            </div>
            {schedLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</div>
            ) : scheduledCalls.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>No scheduled calls. Click &quot;+ Schedule a Call&quot; to add one.</div>
            ) : (
              <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Phone</th>
                      <th>Scheduled For</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledCalls.map((call) => {
                      const overdue = isOverdue(call.scheduledAt, call.status);
                      const soon = isDueSoon(call.scheduledAt, call.status);
                      return (
                        <tr key={call.id} style={overdue ? { background: "#ef444408" } : soon ? { background: "#c69a4b08" } : {}}>
                          <td style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                            {call.contactName ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                          </td>
                          <td style={{ fontFamily: "monospace", fontSize: "0.88rem" }}>{call.phoneNumber}</td>
                          <td style={{ whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                            <span style={{ color: overdue ? "#ef4444" : soon ? "var(--brand-gold)" : "var(--text)" }}>
                              {fmtScheduled(call.scheduledAt)}
                            </span>
                            {overdue && <span style={{ marginLeft: "0.4rem", fontSize: "0.72rem", color: "#ef4444", fontWeight: 700 }}>OVERDUE</span>}
                            {soon && !overdue && <span style={{ marginLeft: "0.4rem", fontSize: "0.72rem", color: "var(--brand-gold)", fontWeight: 700 }}>DUE SOON</span>}
                          </td>
                          <td>
                            <span className="badge" style={{
                              background: `${SCHED_STATUS_COLORS[call.status] ?? "var(--text-muted)"}22`,
                              color: SCHED_STATUS_COLORS[call.status] ?? "var(--text-muted)",
                              border: `1px solid ${SCHED_STATUS_COLORS[call.status] ?? "var(--text-muted)"}44`,
                            }}>
                              {SCHED_STATUS_LABELS[call.status] ?? call.status}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: "14rem" }}>
                            {call.notes ? <span title={call.notes}>{call.notes.length > 50 ? call.notes.slice(0, 50) + "…" : call.notes}</span> : "—"}
                          </td>
                          <td>
                            <div className="inline-row" style={{ gap: "0.35rem" }}>
                              {call.status === "PENDING" && (
                                <button
                                  style={{ ...actionBtnStyle, color: "#4ade80", borderColor: "#4ade8044" }}
                                  onClick={() => void markSchedDone(call.id)}
                                  title="Mark as done"
                                >
                                  ✓ Done
                                </button>
                              )}
                              <button style={actionBtnStyle} onClick={() => openEditSched(call)} title="Edit">Edit</button>
                              <button style={{ ...actionBtnStyle, color: "var(--danger)", borderColor: "var(--danger)44" }} onClick={() => void handleSchedDelete(call.id)} title="Delete">Del</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 3-dot dropdown (fixed position, escapes table overflow) ── */}
      {menuOpenId && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 300,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            minWidth: "170px",
            overflow: "hidden",
          }}
        >
          {(() => {
            const rec = records.find((r) => r.id === menuOpenId);
            if (!rec) return null;
            return (
              <>
                <button style={menuItemStyle} onClick={() => { setEditStatusId(rec.id); setEditStatus(rec.status); setMenuOpenId(null); setMenuPos(null); }}>Change Status</button>
                {!rec.convertedToLandlordId && <button style={menuItemStyle} onClick={() => openLandlordModal(rec)}>Add to Landlords</button>}
                {!rec.convertedToTenantId && <button style={menuItemStyle} onClick={() => openTenantModal(rec)}>Add to Tenants</button>}
                <button style={{ ...menuItemStyle, color: "var(--danger)", borderBottom: "none" }} onClick={() => void handleDeleteRecord(rec.id)}>Delete Record</button>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Add Landlord Modal ── */}
      {landlordModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>Add to Landlords</h2>
              <button style={closeBtn} onClick={() => setLandlordModal(null)}>✕</button>
            </div>
            <div className="field-grid">
              <label className="field">
                <span className="label">Phone Number</span>
                <div className="inline-row">
                  <UIInput style={{ flex: 1 }} value={landlordModal.phone} readOnly disabled />
                  <UIButton variant="secondary" onClick={() => void checkLlPhone(landlordModal.phone)} disabled={llChecking || llBusy}>
                    {llChecking ? "Checking..." : "Check"}
                  </UIButton>
                </div>
                <span className="hint-text">Pre-filled from call record. Click Check to verify availability.</span>
              </label>
              {llConflict && <div style={{ color: "var(--danger)", fontSize: "0.85rem", padding: "0.5rem", background: "#ef444422", borderRadius: 6 }}>{llConflict}</div>}
              {llMsg && !llConflict && <div style={{ color: llChecked ? "#4ade80" : "var(--text-muted)", fontSize: "0.82rem" }}>{llMsg}</div>}
              {llChecked && !llConflict && (
                <>
                  <div className="field-grid-2">
                    <label className="field">
                      <span className="label">Full Name <span style={{ color: "var(--danger)" }}>*</span></span>
                      <UIInput value={llName} onChange={(e) => setLlName(e.target.value)} placeholder="John Smith" disabled={llBusy} />
                    </label>
                    <label className="field">
                      <span className="label">Email (optional)</span>
                      <UIInput type="email" value={llEmail} onChange={(e) => setLlEmail(e.target.value)} placeholder="john@example.com" disabled={llBusy} />
                    </label>
                  </div>
                  <label className="field">
                    <span className="label">Notes (optional)</span>
                    <UIInput value={llNotes} onChange={(e) => setLlNotes(e.target.value)} placeholder="Notes..." disabled={llBusy} />
                  </label>
                </>
              )}
              <div className="inline-row">
                <UIButton onClick={() => void handleAddLandlord()} disabled={!llChecked || !llName.trim() || llBusy || !!llConflict}>
                  {llBusy ? "Creating..." : "Create Landlord"}
                </UIButton>
                <UIButton variant="secondary" onClick={() => setLandlordModal(null)}>Cancel</UIButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Tenant Modal ── */}
      {tenantModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>Add to Tenants</h2>
              <button style={closeBtn} onClick={() => setTenantModal(null)}>✕</button>
            </div>
            <div className="field-grid">
              <label className="field">
                <span className="label">Phone Number</span>
                <UIInput value={tenantModal.phone} readOnly disabled />
                <span className="hint-text">Pre-filled from call record.</span>
              </label>
              {tnMsg && <div style={{ color: "var(--danger)", fontSize: "0.85rem", padding: "0.5rem", background: "#ef444422", borderRadius: 6 }}>{tnMsg}</div>}
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Full Name <span style={{ color: "var(--danger)" }}>*</span></span>
                  <UIInput value={tnName} onChange={(e) => setTnName(e.target.value)} placeholder="Jane Doe" disabled={tnBusy} />
                </label>
                <label className="field">
                  <span className="label">Email (optional)</span>
                  <UIInput type="email" value={tnEmail} onChange={(e) => setTnEmail(e.target.value)} placeholder="jane@example.com" disabled={tnBusy} />
                </label>
              </div>
              <label className="field">
                <span className="label">Notes (optional)</span>
                <UIInput value={tnNotes} onChange={(e) => setTnNotes(e.target.value)} placeholder="Notes..." disabled={tnBusy} />
              </label>
              <div className="inline-row">
                <UIButton onClick={() => void handleAddTenant()} disabled={!tnName.trim() || tnBusy}>{tnBusy ? "Creating..." : "Create Tenant"}</UIButton>
                <UIButton variant="secondary" onClick={() => setTenantModal(null)}>Cancel</UIButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Scheduled Call Modal ── */}
      {editSched && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>Edit Scheduled Call</h2>
              <button style={closeBtn} onClick={() => setEditSched(null)}>✕</button>
            </div>
            <div className="field-grid">
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Phone Number</span>
                  <UIInput value={editSchedPhone} readOnly disabled />
                </label>
                <label className="field">
                  <span className="label">Contact Name (optional)</span>
                  <UIInput value={editSchedContact} onChange={(e) => setEditSchedContact(e.target.value)} placeholder="e.g. John Smith" disabled={editSchedBusy} />
                </label>
              </div>
              <label className="field">
                <span className="label">Date & Time <span style={{ color: "var(--danger)" }}>*</span></span>
                <input type="datetime-local" className="input" value={editSchedAt} onChange={(e) => setEditSchedAt(e.target.value)} disabled={editSchedBusy} />
              </label>
              <label className="field">
                <span className="label">Status</span>
                <select className="input" value={editSchedStatus} onChange={(e) => setEditSchedStatus(e.target.value)} disabled={editSchedBusy}>
                  {Object.entries(SCHED_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Notes (optional)</span>
                <UIInput value={editSchedNotes} onChange={(e) => setEditSchedNotes(e.target.value)} placeholder="Purpose or context..." disabled={editSchedBusy} />
              </label>
              <div className="inline-row">
                <UIButton onClick={() => void handleSchedUpdate()} disabled={editSchedBusy}>{editSchedBusy ? "Saving..." : "Save Changes"}</UIButton>
                <UIButton variant="secondary" onClick={() => setEditSched(null)}>Cancel</UIButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
  zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem",
};

const modalStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "12px", padding: "1.5rem", width: "100%", maxWidth: "500px",
  boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
};

const menuItemStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "0.65rem 1rem",
  background: "none", border: "none", textAlign: "left",
  cursor: "pointer", color: "var(--text)", fontSize: "0.85rem",
  borderBottom: "1px solid var(--border)",
};

const closeBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem", padding: "0.25rem",
};

const actionBtnStyle: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)",
  color: "var(--text-muted)", cursor: "pointer", borderRadius: 6,
  fontSize: "0.78rem", padding: "0.25rem 0.6rem",
};
