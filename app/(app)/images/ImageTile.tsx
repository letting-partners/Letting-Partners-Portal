"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { archiveImageAction, updateAltTextAction } from "@/app/actions/images";

/** One image in the library, with inline alt text editing. */
export default function ImageTile({
  id,
  url,
  fileName,
  altText,
  usageCount,
  meta,
  canDelete,
}: {
  id: string;
  url: string;
  fileName: string;
  altText: string;
  usageCount: number;
  meta: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(altText);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveAlt() {
    startTransition(async () => {
      const result = await updateAltTextAction(id, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(false);
      toast.success("Alt text updated.");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await archiveImageAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmDelete(false);
      toast.success("Image removed from the library.");
      router.refresh();
    });
  }

  return (
    <figure className="stack--sm stack" style={{ margin: 0 }}>
      <div className="image-tile">
        <img src={url} alt={altText || fileName} loading="lazy" />
        <figcaption className="image-tile-bar">
          <span className="truncate">{fileName}</span>
          {usageCount > 0 && (
            <span className="badge badge--positive">
              {usageCount} use{usageCount === 1 ? "" : "s"}
            </span>
          )}
        </figcaption>
      </div>

      {editing ? (
        <div className="stack--sm stack">
          <textarea
            className="textarea"
            rows={2}
            value={value}
            aria-label={`Alt text for ${fileName}`}
            onChange={(event) => setValue(event.target.value)}
          />
          <div className="row">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={saveAlt}
              disabled={pending || !value.trim()}
            >
              <Check size={13} />
              Save
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setValue(altText);
                setEditing(false);
              }}
              disabled={pending}
            >
              <X size={13} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="small" style={{ lineHeight: 1.4 }}>
            {altText || <span className="subtle">No alt text</span>}
          </p>
          <div className="row row--between">
            <span className="subtle" style={{ fontSize: "0.7rem" }}>
              {meta}
            </span>
            <div className="row">
              <button
                type="button"
                className="btn btn--ghost btn--icon btn--sm"
                onClick={() => setEditing(true)}
                aria-label={`Edit alt text for ${fileName}`}
              >
                <Pencil size={13} />
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="btn btn--ghost btn--icon btn--sm"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={`Remove ${fileName}`}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Remove this image?"
        message={
          usageCount > 0
            ? "This image is still used on a property. Remove it from the property first."
            : "It will be removed from the library and from storage. This cannot be undone."
        }
        confirmLabel="Remove"
        danger
        pending={pending}
      />
    </figure>
  );
}
