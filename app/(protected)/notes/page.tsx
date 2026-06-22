"use client";

import { useEffect, useRef, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

type AgentNote = {
  id: string;
  title: string | null;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function NotesPage() {
  const [notes, setNotes] = useState<AgentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // New note form
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addPinned, setAddPinned] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  // Edit note modal
  const [editNote, setEditNote] = useState<AgentNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPinned, setEditPinned] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  // Expand note
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Search
  const [search, setSearch] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function load() {
    setLoading(true);
    const result = await apiGet<{ notes: AgentNote[] }>("/api/notes");
    setLoading(false);
    if (!result.ok) { setMessage({ type: "error", text: result.message ?? "Failed to load notes." }); return; }
    setNotes(result.data.notes);
  }

  useEffect(() => { void load(); }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (showAdd && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [addContent, showAdd]);

  async function handleAdd() {
    if (!addContent.trim()) { setMessage({ type: "error", text: "Note content is required." }); return; }
    setAddBusy(true); setMessage(null);
    const result = await apiPost<object, { note: AgentNote }>("/api/notes", {
      title: addTitle.trim() || null,
      content: addContent.trim(),
      isPinned: addPinned,
    });
    setAddBusy(false);
    if (!result.ok) { setMessage({ type: "error", text: result.message ?? "Failed to save note." }); return; }
    setMessage({ type: "success", text: "Note saved." });
    setShowAdd(false); setAddTitle(""); setAddContent(""); setAddPinned(false);
    await load();
  }

  function openEdit(note: AgentNote) {
    setEditNote(note);
    setEditTitle(note.title ?? "");
    setEditContent(note.content);
    setEditPinned(note.isPinned);
  }

  async function handleUpdate() {
    if (!editNote) return;
    if (!editContent.trim()) { setMessage({ type: "error", text: "Note content is required." }); return; }
    setEditBusy(true); setMessage(null);
    const result = await apiPatch<object, { note: AgentNote }>(`/api/notes/${editNote.id}`, {
      title: editTitle.trim() || null,
      content: editContent.trim(),
      isPinned: editPinned,
    });
    setEditBusy(false);
    if (!result.ok) { setMessage({ type: "error", text: result.message ?? "Failed to update note." }); return; }
    setEditNote(null);
    setMessage({ type: "success", text: "Note updated." });
    await load();
  }

  async function togglePin(note: AgentNote) {
    await apiPatch(`/api/notes/${note.id}`, { isPinned: !note.isPinned });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return;
    const result = await apiDelete(`/api/notes/${id}`);
    if (!result.ok) { setMessage({ type: "error", text: result.message ?? "Failed to delete." }); return; }
    setMessage({ type: "success", text: "Note deleted." });
    await load();
  }

  const filtered = notes.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (n.title?.toLowerCase().includes(q) ?? false) ||
      n.content.toLowerCase().includes(q)
    );
  });

  const pinned = filtered.filter((n) => n.isPinned);
  const unpinned = filtered.filter((n) => !n.isPinned);

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">My Notes</h1>
          <p className="page-subtitle">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
        </div>
        <UIButton onClick={() => { setShowAdd((v) => !v); setMessage(null); }}>
          {showAdd ? "Cancel" : "+ New Note"}
        </UIButton>
      </header>

      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      {/* New note inline form */}
      {showAdd && (
        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="section-label" style={{ marginBottom: "1rem" }}>New Note</p>
          <div className="field-grid">
            <label className="field">
              <span className="label">Title (optional)</span>
              <input
                className="input"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="e.g. Landlord follow-up checklist"
                disabled={addBusy}
              />
            </label>
            <label className="field">
              <span className="label">Content <span style={{ color: "var(--danger)" }}>*</span></span>
              <textarea
                ref={textareaRef}
                className="input"
                value={addContent}
                onChange={(e) => {
                  setAddContent(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                placeholder="Write your note here..."
                disabled={addBusy}
                rows={4}
                style={{ resize: "none", overflow: "hidden", fontFamily: "inherit", lineHeight: 1.6 }}
              />
            </label>
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.6rem" }}>
              <input
                type="checkbox"
                checked={addPinned}
                onChange={(e) => setAddPinned(e.target.checked)}
                disabled={addBusy}
                style={{ width: 16, height: 16, accentColor: "var(--brand-gold)" }}
              />
              <span className="label" style={{ margin: 0 }}>Pin this note</span>
            </label>
            <div className="inline-row">
              <UIButton onClick={() => void handleAdd()} disabled={addBusy}>{addBusy ? "Saving..." : "Save Note"}</UIButton>
              <UIButton variant="secondary" onClick={() => { setShowAdd(false); setAddTitle(""); setAddContent(""); setAddPinned(false); }}>Cancel</UIButton>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {notes.length > 0 && (
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes..."
          style={{ maxWidth: "24rem" }}
        />
      )}

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</div>
      ) : notes.length === 0 ? (
        <div className="panel" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📝</div>
          <p style={{ margin: 0 }}>No notes yet. Click &quot;+ New Note&quot; to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>No notes match your search.</div>
      ) : (
        <>
          {/* Pinned notes */}
          {pinned.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--brand-gold)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  📌 Pinned
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                {pinned.map((note) => <NoteCard key={note.id} note={note} expandedId={expandedId} setExpandedId={setExpandedId} onEdit={openEdit} onDelete={handleDelete} onPin={togglePin} />)}
              </div>
            </>
          )}

          {/* Unpinned notes */}
          {unpinned.length > 0 && (
            <>
              {pinned.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    All Notes
                  </span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                {unpinned.map((note) => <NoteCard key={note.id} note={note} expandedId={expandedId} setExpandedId={setExpandedId} onEdit={openEdit} onDelete={handleDelete} onPin={togglePin} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* Edit modal */}
      {editNote && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>Edit Note</h2>
              <button style={closeBtn} onClick={() => setEditNote(null)}>✕</button>
            </div>
            <div className="field-grid">
              <label className="field">
                <span className="label">Title (optional)</span>
                <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Note title..." disabled={editBusy} />
              </label>
              <label className="field">
                <span className="label">Content <span style={{ color: "var(--danger)" }}>*</span></span>
                <textarea
                  className="input"
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  disabled={editBusy}
                  rows={6}
                  style={{ resize: "none", overflow: "hidden", fontFamily: "inherit", lineHeight: 1.6 }}
                />
              </label>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.6rem" }}>
                <input type="checkbox" checked={editPinned} onChange={(e) => setEditPinned(e.target.checked)} disabled={editBusy} style={{ width: 16, height: 16, accentColor: "var(--brand-gold)" }} />
                <span className="label" style={{ margin: 0 }}>Pin this note</span>
              </label>
              <div className="inline-row">
                <UIButton onClick={() => void handleUpdate()} disabled={editBusy}>{editBusy ? "Saving..." : "Save Changes"}</UIButton>
                <UIButton variant="secondary" onClick={() => setEditNote(null)}>Cancel</UIButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  expandedId,
  setExpandedId,
  onEdit,
  onDelete,
  onPin,
}: {
  note: AgentNote;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onEdit: (note: AgentNote) => void;
  onDelete: (id: string) => void;
  onPin: (note: AgentNote) => void;
}) {
  const isExpanded = expandedId === note.id;
  const isLong = note.content.length > 160;

  function fmt(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${note.isPinned ? "var(--brand-gold)55" : "var(--border)"}`,
        borderRadius: 10,
        padding: "1.1rem 1.1rem 0.8rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        boxShadow: note.isPinned ? "0 0 0 1px var(--brand-gold)22" : "none",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", flex: 1, wordBreak: "break-word" }}>
          {note.title || <span style={{ color: "var(--text-muted)", fontWeight: 400, fontStyle: "italic" }}>Untitled</span>}
        </div>
        <button
          onClick={() => void onPin(note)}
          title={note.isPinned ? "Unpin" : "Pin"}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: note.isPinned ? "var(--brand-gold)" : "var(--text-muted)",
            fontSize: "1rem", padding: "0.1rem", flexShrink: 0,
          }}
        >
          📌
        </button>
      </div>

      {/* Content */}
      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
        {isExpanded || !isLong
          ? note.content
          : note.content.slice(0, 160) + "…"}
      </div>
      {isLong && (
        <button
          onClick={() => setExpandedId(isExpanded ? null : note.id)}
          style={{ background: "none", border: "none", color: "var(--brand-gold)", cursor: "pointer", fontSize: "0.78rem", padding: 0, textAlign: "left" }}
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.25rem" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{fmt(note.updatedAt)}</span>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          <button
            onClick={() => onEdit(note)}
            style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", borderRadius: 5, fontSize: "0.75rem", padding: "0.2rem 0.55rem" }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(note.id)}
            style={{ background: "none", border: "1px solid var(--danger)44", color: "var(--danger)", cursor: "pointer", borderRadius: 5, fontSize: "0.75rem", padding: "0.2rem 0.55rem" }}
          >
            Delete
          </button>
        </div>
      </div>
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
  borderRadius: "12px", padding: "1.5rem", width: "100%", maxWidth: "540px",
  boxShadow: "0 8px 40px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto",
};

const closeBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem", padding: "0.25rem",
};
