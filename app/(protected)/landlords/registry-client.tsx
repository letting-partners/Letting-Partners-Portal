"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDate } from "@/lib/format";
import { fetchLandlords, type LandlordRow, type SessionRole } from "@/lib/portal-api";
import { PhoneLookupModal } from "@/components/phone-lookup-modal";

type Props = {
  currentUserId: string;
  currentRole: SessionRole;
};

export function LandlordsRegistryClient({ currentUserId, currentRole }: Props) {
  const [showLookup, setShowLookup] = useState(false);
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState("");
  const [phoneLast10, setPhoneLast10] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<LandlordRow[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  async function load() {
    setBusy(true);
    setMessage(null);

    const result = await fetchLandlords({
      search: search || undefined,
      agent: agent || undefined,
      phoneLast10: phoneLast10 || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize,
      mine: currentRole === "AGENT" ? true : undefined,
    });

    setBusy(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load landlords." });
      return;
    }

    setRows(result.data.landlords);
    setTotalPages(result.data.pagination.totalPages);
    setTotal(result.data.pagination.total);
  }

  function canEdit(row: LandlordRow) {
    return currentRole === "ADMIN" || row.ownerAgent.id === currentUserId;
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Landlords</h1>
          <p className="page-subtitle">Landlords are added automatically via the phone lookup workflow.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowLookup(true)}>
          Start a Call
        </button>
        <PhoneLookupModal open={showLookup} onClose={() => setShowLookup(false)} />
      </header>

      <UICard>
        <UICardBody className="stack">
          <div className="two-col">
            <div className="field-grid">
              <label className="field">
                <span className="label">Search</span>
                <UIInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, phone, email"
                />
              </label>
              <label className="field">
                <span className="label">Phone Last 10</span>
                <UIInput
                  value={phoneLast10}
                  onChange={(event) => setPhoneLast10(event.target.value)}
                  placeholder="7911122233"
                />
              </label>
            </div>

            <div className="field-grid">
              {currentRole === "ADMIN" && (
                <label className="field">
                  <span className="label">Agent</span>
                  <UIInput
                    value={agent}
                    onChange={(event) => setAgent(event.target.value)}
                    placeholder="Agent name/email/id"
                  />
                </label>
              )}

              <div className="inline-row">
                <label className="field" style={{ flex: 1 }}>
                  <span className="label">Date From</span>
                  <UIInput type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                </label>
                <label className="field" style={{ flex: 1 }}>
                  <span className="label">Date To</span>
                  <UIInput type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                </label>
              </div>
            </div>
          </div>

          <div className="inline-row">
            <UIButton onClick={() => { setPage(1); void load(); }} disabled={busy}>
              {busy ? "Loading..." : "Apply Filters"}
            </UIButton>
            <UIButton
              variant="secondary"
              onClick={() => {
                setSearch(""); setAgent(""); setPhoneLast10("");
                setDateFrom(""); setDateTo(""); setPage(1);
                void load();
              }}
              disabled={busy}
            >
              Reset
            </UIButton>
          </div>

          {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  {currentRole === "ADMIN" && <th>Owner Agent</th>}
                  <th>Properties</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={`/landlords/${row.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                        {row.landlordName}
                      </Link>
                    </td>
                    <td><code>{row.phoneLast10}</code></td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{row.email ?? "—"}</td>
                    {currentRole === "ADMIN" && <td style={{ fontSize: "0.82rem" }}>{row.ownerAgent.agentDisplayName}</td>}
                    <td>{row._count?.properties ?? 0}</td>
                    <td>
                      {row.isPassive ? (
                        <span className="badge badge-draft">Passive</span>
                      ) : (
                        <span className="badge badge-active">Active</span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatDate(row.createdAt)}</td>
                    <td>
                      <div className="inline-row">
                        {canEdit(row) && (
                          <Link className="btn btn-secondary" href={`/landlords/${row.id}`}>
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={currentRole === "ADMIN" ? 8 : 7} className="muted">
                      No landlords found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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
        </UICardBody>
      </UICard>
    </div>
  );
}
