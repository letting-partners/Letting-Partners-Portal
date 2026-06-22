"use client";

import { FormEvent, useMemo, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import {
  deleteDialerCallHistory,
  updateDialerCallHistory,
  type DialerCallHistoryRow,
} from "@/lib/portal-api";
import { formatDateTime } from "@/lib/format";

type Props = {
  initialCalls: DialerCallHistoryRow[];
  contactOptions: Array<{ id: string; fullName: string }>;
};

type FilterDirection = "ALL" | DialerCallHistoryRow["direction"];
type FilterStatus = "ALL" | DialerCallHistoryRow["status"];

function formatDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function DialerHistoryClient({ initialCalls, contactOptions }: Props) {
  const [calls, setCalls] = useState(initialCalls);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<FilterDirection>("ALL");
  const [status, setStatus] = useState<FilterStatus>("ALL");
  const [contactId, setContactId] = useState("ALL");
  const [editingCallId, setEditingCallId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editRecordingUrl, setEditRecordingUrl] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCallId, setDeletingCallId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();
    return calls.filter((call) => {
      const matchesDirection = direction === "ALL" || call.direction === direction;
      const matchesStatus = status === "ALL" || call.status === status;
      const matchesContact = contactId === "ALL" || call.contact?.id === contactId;
      const matchesSearch =
        query.length === 0 ||
        (call.peerName ?? "").toLowerCase().includes(query) ||
        (call.peerNumber ?? "").toLowerCase().includes(query) ||
        (call.peerExtension ?? "").toLowerCase().includes(query) ||
        (call.contact?.fullName ?? "").toLowerCase().includes(query) ||
        (call.counterpartUser?.name ?? "").toLowerCase().includes(query) ||
        (call.notes ?? "").toLowerCase().includes(query);
      return matchesDirection && matchesStatus && matchesContact && matchesSearch;
    });
  }, [calls, contactId, direction, search, status]);

  const totals = useMemo(() => {
    return {
      total: filteredCalls.length,
      incoming: filteredCalls.filter((call) => call.direction === "INCOMING").length,
      outgoing: filteredCalls.filter((call) => call.direction === "OUTGOING").length,
      internal: filteredCalls.filter((call) => call.direction === "INTERNAL").length,
      missed: filteredCalls.filter((call) => call.status === "MISSED").length,
    };
  }, [filteredCalls]);

  function startEdit(call: DialerCallHistoryRow) {
    setEditingCallId(call.id);
    setEditNotes(call.notes ?? "");
    setEditRecordingUrl(call.recordingUrl ?? "");
  }

  function cancelEdit() {
    setEditingCallId(null);
    setEditNotes("");
    setEditRecordingUrl("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCallId) return;
    setSavingEdit(true);
    setMessage(null);

    const result = await updateDialerCallHistory(editingCallId, {
      notes: editNotes.trim() || null,
      recordingUrl: editRecordingUrl.trim() || null,
    });
    setSavingEdit(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update call log." });
      return;
    }

    setCalls((prev) => prev.map((call) => (call.id === result.data.call.id ? result.data.call : call)));
    setMessage({ type: "success", text: result.data.message });
    cancelEdit();
  }

  async function handleDelete(callId: string) {
    setDeletingCallId(callId);
    setMessage(null);
    const result = await deleteDialerCallHistory(callId);
    setDeletingCallId(null);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to delete call log." });
      return;
    }
    setCalls((prev) => prev.filter((call) => call.id !== callId));
    setMessage({ type: "success", text: result.data.message });
  }

  return (
    <div className="stack">
      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <section className="dialer-card">
        <div className="dialer-history-toolbar">
          <UIInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search peer, number, notes..."
            style={{ minWidth: 220 }}
          />
          <select className="select" value={direction} onChange={(event) => setDirection(event.target.value as FilterDirection)}>
            <option value="ALL">All Directions</option>
            <option value="INCOMING">Incoming</option>
            <option value="OUTGOING">Outgoing</option>
            <option value="INTERNAL">Internal</option>
          </select>
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value as FilterStatus)}>
            <option value="ALL">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="ANSWERED">Answered</option>
            <option value="MISSED">Missed</option>
            <option value="REJECTED">Rejected</option>
            <option value="FAILED">Failed</option>
            <option value="RINGING">Ringing</option>
          </select>
          <select className="select" value={contactId} onChange={(event) => setContactId(event.target.value)}>
            <option value="ALL">All Contacts</option>
            {contactOptions.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="dialer-history-stats">
          <span>Total: {totals.total}</span>
          <span>Incoming: {totals.incoming}</span>
          <span>Outgoing: {totals.outgoing}</span>
          <span>Internal: {totals.internal}</span>
          <span>Missed: {totals.missed}</span>
        </div>
      </section>

      {editingCallId && (
        <section className="dialer-card">
          <div className="dialer-card-head">
            <h2 className="dialer-card-title">Edit Call Notes</h2>
          </div>
          <form className="field-grid" onSubmit={saveEdit}>
            <label className="field">
              <span className="label">Notes</span>
              <textarea
                className="textarea"
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                placeholder="Add follow-up notes"
              />
            </label>
            <label className="field">
              <span className="label">Recording URL</span>
              <UIInput
                value={editRecordingUrl}
                onChange={(event) => setEditRecordingUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="inline-row">
              <UIButton type="submit" disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </UIButton>
              <UIButton type="button" variant="secondary" onClick={cancelEdit}>
                Cancel
              </UIButton>
            </div>
          </form>
        </section>
      )}

      <section className="dialer-card">
        {filteredCalls.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No call history found with the selected filters.
          </p>
        ) : (
          <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Direction</th>
                  <th>Peer</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Started</th>
                  <th>Recording</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map((call) => (
                  <tr key={call.id}>
                    <td>{call.direction}</td>
                    <td>
                      <strong style={{ display: "block", color: "var(--text)" }}>
                        {call.peerName || call.contact?.fullName || call.counterpartUser?.name || "-"}
                      </strong>
                      <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                        {call.peerNumber || call.peerExtension || call.contact?.phoneNumber || call.counterpartUser?.email || "-"}
                      </span>
                      {call.notes ? (
                        <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-subtle)", marginTop: "0.18rem" }}>
                          {call.notes.length > 72 ? `${call.notes.slice(0, 72)}...` : call.notes}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          call.status === "COMPLETED" || call.status === "ANSWERED"
                            ? "badge-active"
                            : call.status === "MISSED" || call.status === "FAILED" || call.status === "REJECTED"
                              ? "badge-locked"
                              : "badge-warning"
                        }`}
                      >
                        {call.status}
                      </span>
                    </td>
                    <td>{formatDuration(call.durationSec)}</td>
                    <td>{formatDateTime(call.startedAt)}</td>
                    <td>
                      {call.recordingUrl ? (
                        <a
                          href={call.recordingUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--brand-gold)" }}
                        >
                          Open
                        </a>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>
                      <div className="inline-row">
                        <UIButton variant="secondary" onClick={() => startEdit(call)}>
                          Notes
                        </UIButton>
                        <UIButton
                          variant="danger"
                          onClick={() => void handleDelete(call.id)}
                          disabled={deletingCallId === call.id}
                        >
                          {deletingCallId === call.id ? "..." : "Delete"}
                        </UIButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
