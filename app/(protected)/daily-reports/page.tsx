"use client";

import { useEffect, useMemo, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { apiGet } from "@/lib/api-client";

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
};

function formatDialingArea(value: DialingArea | null) {
  return value ? value.replace("_", " ") : "—";
}

export default function DailyReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  async function load() {
    setLoading(true);
    const result = await apiGet<{ reports: DailyReport[] }>("/api/daily-reports");
    setLoading(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load reports." });
      return;
    }
    setReports(result.data.reports);
  }

  useEffect(() => {
    void load();
  }, []);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (!query) return true;
      return [
        formatDate(report.reportDate).toLowerCase(),
        formatDialingArea(report.dialingArea).toLowerCase(),
        report.notes?.toLowerCase() ?? "",
      ].some((value) => value.includes(query));
    });
  }, [reports, search]);

  const total = filteredReports.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const paginatedReports = filteredReports.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Daily Reports</h1>
          <p className="page-subtitle">{reports.length} report{reports.length !== 1 ? "s" : ""} submitted. Reports are updated automatically by the workflow.</p>
        </div>
      </header>

      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <div className="panel">
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>Previous Reports</h2>
          <UIInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by date, area, or notes"
            style={{ minWidth: "260px", maxWidth: "360px" }}
          />
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading reports...</div>
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>No reports submitted yet.</div>
        ) : (
          <div className="stack" style={{ paddingBottom: "1rem" }}>
            <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
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
                  {paginatedReports.map((report) => (
                    <tr key={report.id}>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{formatDate(report.reportDate)}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{formatDialingArea(report.dialingArea)}</td>
                      <td style={{ textAlign: "center" }}>{report.callsMade}</td>
                      <td style={{ textAlign: "center", color: "#4ade80", fontWeight: 600 }}>{report.callsConnected}</td>
                      <td style={{ textAlign: "center", color: "var(--danger)" }}>{report.callsFailed}</td>
                      <td style={{ textAlign: "center", color: "var(--brand-gold)", fontWeight: 600 }}>{report.landlordConfirm}</td>
                      <td style={{ textAlign: "center" }}>{report.viewingsArranged}</td>
                      <td style={{ textAlign: "center", color: "#4ade80" }}>{report.successfulViewings}</td>
                      <td style={{ textAlign: "center" }}>{report.followUp}</td>
                      <td style={{ textAlign: "center" }}>{report.reSchedule}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: "14rem" }}>
                        {report.notes ? (
                          <span title={report.notes}>{report.notes.length > 60 ? `${report.notes.slice(0, 60)}...` : report.notes}</span>
                        ) : (
                          "—"
                        )}
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
                total={total}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
