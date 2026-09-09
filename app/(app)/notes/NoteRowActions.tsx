"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deleteNoteAction, editNoteAction } from "@/app/actions/notes";

/**
 * Edit and delete for a note in the notes list.
 *
 * The service allows the author or an admin, and keeps every previous version
 * in the note's edit history, so a correction never silently rewrites what was
 * originally said.
 */
export default function NoteRowActions({
  noteId,
  body,
  canManage,
}: {
  noteId: string;
  body: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState(body);

  if (!canManage) return null;

  function save() {
    startTransition(async () => {
      const result = await editNoteAction(noteId, draft, "/notes");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Note updated.");
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteNoteAction(noteId, "/notes");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Note deleted.");
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <>
      <RowMenu label="Note actions">
        <button
          type="button"
          className="menu-item"
          role="menuitem"
          onClick={() => {
            setDraft(body);
            setEditing(true);
          }}
        >
          <Pencil size={15} />
          Edit note
        </button>

        <button
          type="button"
          className="menu-item menu-item--danger"
          role="menuitem"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={15} />
          Delete
        </button>
      </RowMenu>

      <Modal
        open={editing}
        title="Edit note"
        description="The previous version is kept in this note's history."
        onClose={() => setEditing(false)}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={save}
              disabled={pending || !draft.trim() || draft.trim() === body.trim()}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Save changes
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor={`note-body-${noteId}`}>
            Note
          </label>
          <textarea
            id={`note-body-${noteId}`}
            className="input"
            rows={5}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this note?"
        message="The note is archived rather than erased, so the record's history stays intact."
        confirmLabel="Delete"
        danger
        pending={pending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}
