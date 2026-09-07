"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Trash2 } from "lucide-react";
import { addNoteAction, deleteNoteAction } from "@/app/actions/notes";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/layout";
import { formatDateTime, formatRelative } from "@/lib/dates";

/**
 * Internal notes for any record. Deliberately the same component everywhere,
 * so a note on a landlord behaves exactly like a note on a property.
 */

export type NoteRow = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  edited: boolean;
};

export function NotesPanel({
  entityType,
  entityId,
  notes,
  currentUserId,
  canModerate,
  revalidate,
}: {
  entityType: string;
  entityId: string;
  notes: NoteRow[];
  currentUserId: string;
  canModerate: boolean;
  revalidate: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await addNoteAction({ entityType, entityId, body, revalidate });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBody("");
      toast.success("Note added.");
      router.refresh();
    });
  }

  function remove(noteId: string) {
    startTransition(async () => {
      const result = await deleteNoteAction(noteId, revalidate);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Note removed.");
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <div className="stack--sm stack">
        <textarea
          className="textarea"
          rows={3}
          value={body}
          placeholder="Add an internal note. Only staff can see this."
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            // Ctrl/Cmd + Enter submits, the convention for a comment box.
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit();
          }}
        />
        <div className="row row--between">
          <span className="subtle small">Ctrl + Enter to save</span>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={submit}
            disabled={pending || !body.trim()}
          >
            {pending && <span className="spinner" aria-hidden="true" />}
            Add note
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={<StickyNote size={18} />}
          title="No notes yet"
          message="Notes are internal and never appear on the public website."
        />
      ) : (
        <ul className="stack">
          {notes.map((note) => (
            <li
              key={note.id}
              style={{
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "var(--surface-2)",
              }}
            >
              <div className="row row--between" style={{ marginBottom: 6 }}>
                <span className="person">
                  <Avatar name={note.authorName} src={note.authorAvatar} size="sm" />
                  <span>
                    <span className="person-name">{note.authorName}</span>
                    <span className="table-secondary" style={{ display: "block" }}>
                      <time dateTime={note.createdAt} title={formatDateTime(note.createdAt)}>
                        {formatRelative(note.createdAt)}
                      </time>
                      {note.edited && " · edited"}
                    </span>
                  </span>
                </span>

                {(note.authorId === currentUserId || canModerate) && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--sm"
                    onClick={() => remove(note.id)}
                    disabled={pending}
                    aria-label="Remove note"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <p style={{ fontSize: "0.87rem", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {note.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
