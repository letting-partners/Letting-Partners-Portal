"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/layout";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatRelative } from "@/lib/dates";
import {
  createPersonalNoteAction,
  deletePersonalNoteAction,
  updatePersonalNoteAction,
} from "./personal-actions";

/**
 * A private scratchpad, laid out like a notes app: a list on the left, the
 * open note on the right.
 *
 * Typing saves on its own after a pause rather than behind a button, because a
 * scratchpad nobody remembers to save is a scratchpad that loses things. The
 * list updates locally as you type so the title in the sidebar keeps up
 * without waiting for the server.
 */

const AUTOSAVE_MS = 900;

export type PersonalNote = {
  id: string;
  title: string | null;
  body: string;
  pinned: boolean;
  updatedAt: string;
};

export default function PersonalNotes({ notes: initial }: { notes: PersonalNote[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [notes, setNotes] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
   * Edits are accumulated rather than replaced. Title and body share one timer,
   * so sending only the latest change meant typing a title and then a body
   * discarded the title - it stayed on screen and never reached the server.
   */
  const pending_ = useRef<{ id: string; patch: { title?: string | null; body?: string } } | null>(
    null,
  );

  /** Send whatever is queued, now. */
  const flush = useCallback(async () => {
    const queued = pending_.current;
    pending_.current = null;
    if (!queued) return;

    const result = await updatePersonalNoteAction(queued.id, queued.patch);
    setSaving(false);
    if (!result.ok) toast.error(result.error);
  }, [toast]);

  // The server list wins whenever it changes, so a note created or deleted
  // elsewhere does not leave a stale copy on screen.
  useEffect(() => {
    setNotes(initial);
    setActiveId((current) => {
      if (current && initial.some((note) => note.id === current)) return current;
      return initial[0]?.id ?? null;
    });
  }, [initial]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Whatever was still queued when the component goes away.
      void flush();
    };
  }, [flush]);

  const active = notes.find((note) => note.id === activeId) ?? null;

  function patchLocal(id: string, patch: Partial<PersonalNote>) {
    setNotes((current) =>
      current.map((note) => (note.id === id ? { ...note, ...patch } : note)),
    );
  }

  function scheduleSave(id: string, patch: { title?: string | null; body?: string }) {
    patchLocal(id, patch);
    setSaving(true);

    // Switching note mid-edit flushes what was pending for the previous one.
    if (pending_.current && pending_.current.id !== id) void flush();

    pending_.current = { id, patch: { ...pending_.current?.patch, ...patch } };

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }

  function addNote() {
    startTransition(async () => {
      const result = await createPersonalNoteAction({ title: null, body: "" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data) setActiveId(result.data.id);
      router.refresh();
    });
  }

  function togglePin(note: PersonalNote) {
    startTransition(async () => {
      const result = await updatePersonalNoteAction(note.id, { pinned: !note.pinned });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deletePersonalNoteAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Note deleted.");
      setConfirmDelete(null);
      setActiveId(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="notepad">
        <div className="notepad-list">
          <div className="notepad-list-head">
            <span className="card-title">My notes</span>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={addNote}
              disabled={pending}
            >
              <Plus size={14} />
              New
            </button>
          </div>

          {notes.length === 0 ? (
            <p className="subtle small" style={{ padding: "14px 16px" }}>
              Nothing here yet. These notes are yours alone - nobody else in the portal can see
              them, not even an administrator.
            </p>
          ) : (
            <ul>
              {notes.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    className={note.id === activeId ? "notepad-item is-active" : "notepad-item"}
                    onClick={() => setActiveId(note.id)}
                  >
                    <span className="notepad-item-title">
                      {note.pinned && <Pin size={12} aria-label="Pinned" />}
                      {note.title?.trim() || firstLine(note.body) || "Untitled note"}
                    </span>
                    <span className="notepad-item-meta">{formatRelative(note.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="notepad-editor">
          {!active ? (
            <EmptyState
              title="No note open"
              message="Pick a note from the list, or start a new one."
              action={
                <button type="button" className="btn btn--primary btn--sm" onClick={addNote}>
                  New note
                </button>
              }
            />
          ) : (
            <>
              <div className="notepad-editor-head">
                <input
                  className="input input--title"
                  placeholder="Title"
                  value={active.title ?? ""}
                  onChange={(event) => scheduleSave(active.id, { title: event.target.value })}
                />

                <div className="row">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => togglePin(active)}
                    disabled={pending}
                    title={active.pinned ? "Unpin" : "Pin to the top"}
                  >
                    {active.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    {active.pinned ? "Unpin" : "Pin"}
                  </button>

                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setConfirmDelete(active.id)}
                    disabled={pending}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>

              <textarea
                className="notepad-body"
                placeholder="Write anything. It saves as you go."
                value={active.body}
                onChange={(event) => scheduleSave(active.id, { body: event.target.value })}
              />

              <div className="notepad-status subtle small">
                {saving ? "Saving..." : `Saved ${formatRelative(active.updatedAt)}`}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this note?"
        message="It is removed from your notes. Nobody else could see it in any case."
        confirmLabel="Delete"
        danger
        pending={pending}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </>
  );
}

/** A note with no title is listed by its opening line, the way a notes app does. */
function firstLine(body: string): string {
  const line = body.split("\n").find((value) => value.trim());
  return line ? line.trim().slice(0, 60) : "";
}
