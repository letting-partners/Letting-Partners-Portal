"use client";

import { useEffect, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { UISelect } from "@/components/ui/select";
import { apiPatch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { listApprovals, type ApprovalRow } from "@/lib/portal-api";

function truncateJson(value: unknown) {
  if (value === null || value === undefined) return "—";
  try {
    const json = JSON.stringify(value);
    return json.length > 160 ? `${json.slice(0, 160)}...` : json;
  } catch {
    return String(value);
  }
}

export function ApprovalsClient() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | "">("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setBusy(true);
    setMessage(null);
    const result = await listApprovals({
      status: status || undefined,
      search: search.trim() || undefined,
      page,
      pageSize,
    });
    setBusy(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load approval requests." });
      return;
    }

    setRows(result.data.approvals);
    setTotal(result.data.pagination.total);
    setTotalPages(result.data.pagination.totalPages);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  async function reviewApproval(id: string, decision: "APPROVE" | "REJECT") {
    setWorkingId(id);
    setMessage(null);
    const result = await apiPatch(`/api/approvals/${id}`, { decision });
    setWorkingId(null);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to process approval request." });
      return;
    }

    setMessage({
      type: "success",
      text:
        decision === "APPROVE"
          ? "Changes approved and applied."
          : "Changes rejected.",
    });

    await load();
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Edit Approvals</h1>
          <p className="page-subtitle">Review agent edit requests before live data changes.</p>
        </div>
      </header>

      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Filters</h2>
        </div>
        <div className="admin-card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
            <label className="field">
              <span className="label">Status</span>
              <UISelect value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </UISelect>
            </label>
            <label className="field">
              <span className="label">Search</span>
              <UIInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Summary, agent name, email"
              />
            </label>
            <label className="field">
              <span className="label">Rows Per Page</span>
              <UISelect
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
                <option value="150">150 per page</option>
                <option value="200">200 per page</option>
              </UISelect>
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
              {busy ? "Loading..." : "Apply Filters"}
            </UIButton>
            <UIButton variant="secondary" onClick={() => void load()} disabled={busy}>
              Refresh
            </UIButton>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Approval Queue</h2>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Page {page} of {Math.max(totalPages, 1)} · {total} total
          </span>
        </div>
        <div style={{ padding: 0 }}>
          <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Requested By</th>
                  <th>Entity</th>
                  <th>Summary</th>
                  <th>Before</th>
                  <th>Proposed</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {busy ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                      <span className="muted">Loading approval requests...</span>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                      <span className="muted">No approval requests found.</span>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isPending = row.status === "PENDING";
                    const rowBusy = workingId === row.id;
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong style={{ display: "block" }}>{row.requestedBy.agentDisplayName}</strong>
                          <span className="muted" style={{ fontSize: "0.75rem" }}>{row.requestedBy.email}</span>
                        </td>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {row.entityType.replaceAll("_", " ")}
                        </td>
                        <td style={{ maxWidth: "16rem", fontSize: "0.82rem" }}>{row.summary ?? "—"}</td>
                        <td style={{ maxWidth: "16rem" }}>
                          <code style={{ fontSize: "0.72rem", wordBreak: "break-word" }}>{truncateJson(row.beforeJson)}</code>
                        </td>
                        <td style={{ maxWidth: "16rem" }}>
                          <code style={{ fontSize: "0.72rem", wordBreak: "break-word" }}>{truncateJson(row.proposedJson)}</code>
                        </td>
                        <td>
                          <span className={`badge ${
                            row.status === "APPROVED"
                              ? "badge-active"
                              : row.status === "REJECTED"
                              ? "badge-locked"
                              : "badge-offer"
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td>
                          <div className="inline-row">
                            {isPending ? (
                              <>
                                <UIButton
                                  onClick={() => void reviewApproval(row.id, "APPROVE")}
                                  disabled={rowBusy}
                                  style={{ padding: "0.35rem 0.7rem" }}
                                >
                                  {rowBusy ? "Working..." : "Approve"}
                                </UIButton>
                                <UIButton
                                  variant="secondary"
                                  onClick={() => void reviewApproval(row.id, "REJECT")}
                                  disabled={rowBusy}
                                  style={{ padding: "0.35rem 0.7rem" }}
                                >
                                  Reject
                                </UIButton>
                              </>
                            ) : (
                              <span className="muted" style={{ fontSize: "0.78rem" }}>
                                {row.reviewedAt ? `Reviewed ${formatDateTime(row.reviewedAt)}` : "Processed"}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: "0.82rem" }}>{total} total requests</span>
          <div className="inline-row">
            <UIButton variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || busy}>
              Previous
            </UIButton>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              {page} / {Math.max(totalPages, 1)}
            </span>
            <UIButton variant="secondary" onClick={() => setPage((value) => Math.min(Math.max(totalPages, 1), value + 1))} disabled={page >= totalPages || busy || totalPages === 0}>
              Next
            </UIButton>
          </div>
        </div>
      </div>
    </div>
  );
}
