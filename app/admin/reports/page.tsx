"use client";

import { useEffect, useMemo, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { UIInput } from "@/components/ui/input";
import { apiDelete, apiGet } from "@/lib/api-client";

type Agent = { id: string; agentDisplayName: string; email: string };
type DialingArea = "AREA_1" | "AREA_2" | "AREA_3" | "AREA_4" | "AREA_5";

type DailyReport = {
  id: string;
  reportDate: string;
  dialingArea: DialingArea | null;
  callsMade: number;
  callsConnected: number;
  callsFailed: number;
  landlordConfirm: number;
  viewingsArranged: number;
  successfulViewings: number;
  followUp: number;
  reSchedule: number;
  notes: string | null;
  createdAt: string;
  agent: Agent;
};

type CallRecord = {
  id: string;
  phoneNumber: string;
  status: string;
  notes: string | null;
  createdAt: string;
  convertedToLandlordId: string | null;
  convertedToTenantId: string | null;
  convertedLandlord: { id: string; landlordName: string } | null;
  convertedTenant: { id: string; fullName: string } | null;
  agent: Agent;
};

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

function formatDialingArea(value: DialingArea | null) {
  return value ? value.replace("_", " ") : "—";
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<"daily" | "calls">("daily");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [callStatus, setCallStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    apiGet<{ agents: Agent[] }>("/api/admin/users").then((res) => {
      if (res.ok) setAgents(res.data.agents);
    });
  }, []);

  async function loadDailyReports() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (agentId) params.set("agentId", agentId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const result = await apiGet<{ reports: DailyReport[] }>(`/api/admin/daily-reports?${params}`);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? "Failed to load daily reports.");
      return;
    }
    setDailyReports(result.data.reports);
  }

  async function loadCallRecords() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (agentId) params.set("agentId", agentId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (callStatus) params.set("status", callStatus);
    const result = await apiGet<{ records: CallRecord[] }>(`/api/admin/call-records?${params}`);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? "Failed to load call records.");
      return;
    }
    setCallRecords(result.data.records);
  }

  async function handleDeleteCallRecord(id: string) {
    if (!confirm("Permanently delete this call record?")) return;
    const result = await apiDelete(`/api/call-records/${id}`);
    if (!result.ok) {
      setError(result.message ?? "Failed to delete call record.");
      return;
    }
    setCallRecords((prev) => prev.filter((record) => record.id !== id));
  }

  useEffect(() => {
    if (tab === "daily") void loadDailyReports();
    else void loadCallRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, pageSize]);

  function applyFilters() {
    setPage(1);
    if (tab === "daily") void loadDailyReports();
    else void loadCallRecords();
  }

  function resetFilters() {
    setAgentId("");
    setDateFrom("");
    setDateTo("");
    setCallStatus("");
    setSearch("");
    setPage(1);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const filteredDailyReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dailyReports.filter((report) => {
      if (!query) return true;
      return [
        report.agent.agentDisplayName.toLowerCase(),
        report.agent.email.toLowerCase(),
        formatDate(report.reportDate).toLowerCase(),
        formatDialingArea(report.dialingArea).toLowerCase(),
        report.notes?.toLowerCase() ?? "",
      ].some((value) => value.includes(query));
    });
  }, [dailyReports, search]);

  const filteredCallRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return callRecords.filter((record) => {
      if (!query) return true;
      return [
        record.agent.agentDisplayName.toLowerCase(),
        record.agent.email.toLowerCase(),
        record.phoneNumber.toLowerCase(),
        STATUS_LABELS[record.status]?.toLowerCase() ?? record.status.toLowerCase(),
        record.notes?.toLowerCase() ?? "",
        record.convertedLandlord?.landlordName.toLowerCase() ?? "",
        record.convertedTenant?.fullName.toLowerCase() ?? "",
      ].some((value) => value.includes(query));
    });
  }, [callRecords, search]);

  const visibleDailyReports = filteredDailyReports.slice((page - 1) * pageSize, page * pageSize);
  const visibleCallRecords = filteredCallRecords.slice((page - 1) * pageSize, page * pageSize);
  const totalRows = tab === "daily" ? filteredDailyReports.length : filteredCallRecords.length;
  const totalPages = totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize);

  const totals = filteredDailyReports.reduce(
    (acc, report) => ({
      callsMade: acc.callsMade + report.callsMade,
      callsConnected: acc.callsConnected + report.callsConnected,
      callsFailed: acc.callsFailed + report.callsFailed,
      landlordConfirm: acc.landlordConfirm + report.landlordConfirm,
      viewingsArranged: acc.viewingsArranged + report.viewingsArranged,
      successfulViewings: acc.successfulViewings + report.successfulViewings,
      followUp: acc.followUp + report.followUp,
      reSchedule: acc.reSchedule + report.reSchedule,
    }),
    {
      callsMade: 0,
      callsConnected: 0,
      callsFailed: 0,
      landlordConfirm: 0,
      viewingsArranged: 0,
      successfulViewings: 0,
      followUp: 0,
      reSchedule: 0,
    },
  );

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Agent Reports</h1>
          <p className="page-subtitle">Daily task reports and call data from all agents.</p>
        </div>
      </header>

      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {(["daily", "calls"] as const).map((currentTab) => (
          <button
            key={currentTab}
            onClick={() => setTab(currentTab)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === currentTab ? "2px solid var(--brand-gold)" : "2px solid transparent",
              color: tab === currentTab ? "var(--brand-gold)" : "var(--text-muted)",
              fontWeight: tab === currentTab ? 700 : 400,
              padding: "0.6rem 1.1rem",
              cursor: "pointer",
              fontSize: "0.9rem",
              marginBottom: "-1px",
              transition: "color 0.15s",
            }}
          >
            {currentTab === "daily" ? "Daily Task Reports" : "Calls Data"}
          </button>
        ))}
      </div>

      <div className="panel" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="field" style={{ minWidth: "180px", flex: "1 1 180px" }}>
            <span className="label">Agent</span>
            <select className="input" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
              <option value="">All Agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.agentDisplayName}</option>
              ))}
            </select>
          </label>

          <label className="field" style={{ minWidth: "140px" }}>
            <span className="label">Date From</span>
            <UIInput type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>

          <label className="field" style={{ minWidth: "140px" }}>
            <span className="label">Date To</span>
            <UIInput type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>

          {tab === "calls" && (
            <label className="field" style={{ minWidth: "150px" }}>
              <span className="label">Call Status</span>
              <select className="input" value={callStatus} onChange={(event) => setCallStatus(event.target.value)}>
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
          )}

          <label className="field" style={{ minWidth: "240px", flex: "1 1 240px" }}>
            <span className="label">Search</span>
            <UIInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tab === "daily" ? "Agent, date, area, notes" : "Agent, phone, status, notes"}
            />
          </label>

          <div style={{ display: "flex", gap: "0.5rem", paddingBottom: "0.15rem" }}>
            <button className="btn btn-primary btn-sm" onClick={applyFilters} disabled={loading}>
              {loading ? "Loading..." : "Apply"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {error && <UIAlert type="error">{error}</UIAlert>}

      {tab === "daily" && (
        <div className="stack">
          {filteredDailyReports.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem" }}>
              {[
                { label: "Calls Made", value: totals.callsMade, color: "var(--text)" },
                { label: "Connected", value: totals.callsConnected, color: "#4ade80" },
                { label: "Failed", value: totals.callsFailed, color: "var(--danger)" },
                { label: "Landlord Confirm", value: totals.landlordConfirm, color: "var(--brand-gold)" },
                { label: "Viewings Arranged", value: totals.viewingsArranged, color: "var(--text)" },
                { label: "Successful Viewings", value: totals.successfulViewings, color: "#4ade80" },
                { label: "Follow Up", value: totals.followUp, color: "var(--brand-gold)" },
                { label: "Re-Schedule", value: totals.reSchedule, color: "#60a5fa" },
              ].map((card) => (
                <div key={card.label} className="stat-card" style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="panel">
            <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>Daily Task Reports</h2>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{filteredDailyReports.length} records</span>
            </div>

            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</div>
            ) : filteredDailyReports.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>No daily reports found.</div>
            ) : (
              <div className="stack" style={{ paddingBottom: "1rem" }}>
                <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Date</th>
                        <th>Dialing Area</th>
                        <th>Calls Made</th>
                        <th>Connected</th>
                        <th>Failed</th>
                        <th>Landlord Confirm</th>
                        <th>Viewings Arranged</th>
                        <th>Successful Viewings</th>
                        <th>Follow Up</th>
                        <th>Re-Schedule</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDailyReports.map((report) => (
                        <tr key={report.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{report.agent.agentDisplayName}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{report.agent.email}</div>
                          </td>
                          <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{formatDate(report.reportDate)}</td>
                          <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatDialingArea(report.dialingArea)}</td>
                          <td style={{ textAlign: "center" }}>{report.callsMade}</td>
                          <td style={{ textAlign: "center", color: "#4ade80", fontWeight: 600 }}>{report.callsConnected}</td>
                          <td style={{ textAlign: "center", color: "var(--danger)" }}>{report.callsFailed}</td>
                          <td style={{ textAlign: "center", color: "var(--brand-gold)", fontWeight: 600 }}>{report.landlordConfirm}</td>
                          <td style={{ textAlign: "center" }}>{report.viewingsArranged}</td>
                          <td style={{ textAlign: "center", color: "#4ade80" }}>{report.successfulViewings}</td>
                          <td style={{ textAlign: "center" }}>{report.followUp}</td>
                          <td style={{ textAlign: "center" }}>{report.reSchedule}</td>
                          <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: "12rem" }}>
                            {report.notes ? <span title={report.notes}>{report.notes.length > 50 ? `${report.notes.slice(0, 50)}...` : report.notes}</span> : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ padding: "0 1.25rem" }}>
                  <PaginationControls
                    page={page}
                    pageSize={pageSize}
                    total={filteredDailyReports.length}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "calls" && (
        <div className="panel">
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>Calls Data</h2>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{filteredCallRecords.length} records</span>
          </div>

          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</div>
          ) : filteredCallRecords.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>No call records found.</div>
          ) : (
            <div className="stack" style={{ paddingBottom: "1rem" }}>
              <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th>Linked To</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCallRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{record.agent.agentDisplayName}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{record.agent.email}</div>
                        </td>
                        <td style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.9rem" }}>{record.phoneNumber}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: `${STATUS_COLORS[record.status] ?? "var(--text-muted)"}22`,
                              color: STATUS_COLORS[record.status] ?? "var(--text-muted)",
                              border: `1px solid ${STATUS_COLORS[record.status] ?? "var(--text-muted)"}44`,
                            }}
                          >
                            {STATUS_LABELS[record.status] ?? record.status}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: "14rem" }}>
                          {record.notes ? <span title={record.notes}>{record.notes.length > 50 ? `${record.notes.slice(0, 50)}...` : record.notes}</span> : "—"}
                        </td>
                        <td style={{ fontSize: "0.82rem" }}>
                          {record.convertedLandlord ? (
                            <span style={{ color: "var(--brand-gold)" }}>Landlord: {record.convertedLandlord.landlordName}</span>
                          ) : record.convertedTenant ? (
                            <span style={{ color: "#4ade80" }}>Tenant: {record.convertedTenant.fullName}</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {formatDate(record.createdAt)}
                        </td>
                        <td>
                          <button
                            onClick={() => void handleDeleteCallRecord(record.id)}
                            title="Delete call record"
                            style={{
                              background: "none",
                              border: "1px solid var(--danger)",
                              color: "var(--danger)",
                              cursor: "pointer",
                              borderRadius: "5px",
                              fontSize: "0.75rem",
                              padding: "0.25rem 0.55rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: "0 1.25rem" }}>
                <PaginationControls
                  page={page}
                  pageSize={pageSize}
                  total={filteredCallRecords.length}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
