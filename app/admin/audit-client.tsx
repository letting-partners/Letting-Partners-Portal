"use client";

import { useEffect, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDateTime } from "@/lib/format";
import { listAuditLogs, type AuditLogRow } from "@/lib/portal-api";

function truncateJson(value: unknown): string {
  if (value === null || value === undefined) return "â€”";
  try {
    const json = JSON.stringify(value);
    return json.length > 120 ? `${json.slice(0, 120)}â€¦` : json;
  } catch {
    return String(value);
  }
}

function ActionBadge({ action }: { action: string }) {
  let color = "var(--text-muted)";
  let bg = "var(--surface-muted)";
  if (action.includes("CREATE")) {
    color = "#4ade80";
    bg = "rgba(34,197,94,0.12)";
  } else if (action.includes("DELETE") || action.includes("REMOVE")) {
    color = "#f87171";
    bg = "rgba(239,68,68,0.12)";
  } else if (action.includes("UPDATE") || action.includes("EDIT")) {
    color = "var(--brand-gold)";
    bg = "var(--brand-gold-light)";
  } else if (action.includes("STATUS")) {
    color = "#fbbf24";
    bg = "rgba(245,158,11,0.12)";
  }
  return (
    <span
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        fontFamily: "monospace",
        letterSpacing: "0.04em",
        color,
        background: bg,
        padding: "0.18rem 0.5rem",
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
    >
      {action}
    </span>
  );
}

export function AdminAuditClient() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [user, setUser] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setBusy(true);
    setMessage(null);
    const result = await listAuditLogs({
      entityType: entityType || undefined,
      action: action || undefined,
      user: user || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load audit logs." });
      return;
    }
    setLogs(result.data.logs);
    setTotal(result.data.pagination.total);
    setTotalPages(result.data.pagination.totalPages);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  function clearFilters() {
    setEntityType("");
    setAction("");
    setUser("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">
            Review all system changes â€” landlords, agents, properties.
          </p>
        </div>
        <div className="inline-row">
          <span
            style={{
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              background: "var(--surface-muted)",
              padding: "0.35rem 0.75rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            {total} records
          </span>
        </div>
      </header>

      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16, color: "var(--brand-gold)" }}>
              <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
            </svg>
            Filters
          </h2>
          <UIButton variant="secondary" onClick={clearFilters} disabled={busy}>
            Clear
          </UIButton>
        </div>
        <div className="admin-card-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <label className="field">
              <span className="label">Entity Type</span>
              <UIInput value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="LANDLORD, PROPERTYâ€¦" />
            </label>
            <label className="field">
              <span className="label">Action</span>
              <UIInput value={action} onChange={(e) => setAction(e.target.value)} placeholder="LANDLORD_UPDATEâ€¦" />
            </label>
            <label className="field">
              <span className="label">User</span>
              <UIInput value={user} onChange={(e) => setUser(e.target.value)} placeholder="email or display name" />
            </label>
            <label className="field">
              <span className="label">Date From</span>
              <UIInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Date To</span>
              <UIInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
          <div className="inline-row" style={{ marginTop: "0.75rem" }}>
            <UIButton
              onClick={() => {
                setPage(1);
                void load();
              }}
              disabled={busy}
            >
              {busy ? "Loadingâ€¦" : "Apply Filters"}
            </UIButton>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5L9 4H4Z" clipRule="evenodd" />
            </svg>
            Audit Records
          </h2>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Page {page} of {Math.max(totalPages, 1)}
          </span>
        </div>

        <div style={{ padding: 0 }}>
          {logs.length === 0 && !busy ? (
            <div style={{ padding: "2.5rem", textAlign: "center" }}>
              <p className="muted">No audit records match your filters.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>By</th>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                </thead>
                <tbody>
                  {busy ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                        <span className="muted">Loadingâ€¦</span>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td>
                          <ActionBadge action={log.action} />
                        </td>
                        <td>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{log.entityType}</span>
                          <code style={{ display: "block", fontSize: "0.72rem", marginTop: 2 }}>
                            {log.entityId.slice(0, 12)}â€¦
                          </code>
                        </td>
                        <td>
                          <strong style={{ fontSize: "0.85rem" }}>{log.user.agentDisplayName}</strong>
                          <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>
                            {log.user.email}
                          </span>
                        </td>
                        <td style={{ maxWidth: 200 }}>
                          <code style={{ fontSize: "0.72rem", wordBreak: "break-all" }}>{truncateJson(log.beforeJson)}</code>
                        </td>
                        <td style={{ maxWidth: 200 }}>
                          <code style={{ fontSize: "0.72rem", wordBreak: "break-all" }}>{truncateJson(log.afterJson)}</code>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)" }}>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            busy={busy}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
