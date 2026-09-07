"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Upload } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { uploadImageAction } from "@/app/actions/images";

/**
 * Drag-and-drop uploader with per-file progress.
 *
 * Files are uploaded one at a time so a single failure does not lose the rest,
 * and the row for each file reports its own outcome.
 */

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 8 * 1024 * 1024;

type Upload = {
  id: string;
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

export function ImageUploader({
  propertyId,
  onUploaded,
  compact = false,
}: {
  propertyId?: string;
  onUploaded?: (asset: { id: string; url: string; altText: string }) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);
      const queued: Upload[] = files.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name,
        status: "pending",
      }));

      setUploads((current) => [...current, ...queued]);

      let succeeded = 0;

      for (const [index, file] of files.entries()) {
        const uploadId = queued[index].id;

        if (file.size > MAX_BYTES) {
          setUploads((current) =>
            current.map((item) =>
              item.id === uploadId
                ? { ...item, status: "error", error: "Larger than 8 MB" }
                : item,
            ),
          );
          continue;
        }

        setUploads((current) =>
          current.map((item) => (item.id === uploadId ? { ...item, status: "uploading" } : item)),
        );

        const formData = new FormData();
        formData.append("file", file);
        if (propertyId) formData.append("propertyId", propertyId);
        formData.append("index", String(index));

        const result = await uploadImageAction(formData);

        if (!result.ok) {
          setUploads((current) =>
            current.map((item) =>
              item.id === uploadId ? { ...item, status: "error", error: result.error } : item,
            ),
          );
          continue;
        }

        succeeded += 1;
        setUploads((current) =>
          current.map((item) => (item.id === uploadId ? { ...item, status: "done" } : item)),
        );
        onUploaded?.(result.data);
      }

      if (succeeded > 0) {
        toast.success(`${succeeded} image${succeeded === 1 ? "" : "s"} uploaded.`);
        startTransition(() => router.refresh());
        // Clear the finished rows shortly after, keeping any errors visible.
        setTimeout(
          () => setUploads((current) => current.filter((item) => item.status === "error")),
          2500,
        );
      }
    },
    [propertyId, onUploaded, router, toast],
  );

  return (
    <div className="stack--sm stack">
      <div
        className="dropzone"
        data-dragging={dragging}
        style={compact ? { padding: 16 } : undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <Upload size={compact ? 18 : 22} style={{ margin: "0 auto 8px" }} aria-hidden="true" />
        <p style={{ fontSize: "0.87rem" }}>
          Drag photos here, or{" "}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ textDecoration: "underline" }}
            onClick={() => inputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="subtle small">JPEG, PNG, WebP or AVIF. Up to 8 MB each.</p>
      </div>

      {uploads.length > 0 && (
        <ul className="stack--sm stack">
          {uploads.map((upload) => (
            <li key={upload.id} className="row row--between small">
              <span className="truncate">{upload.name}</span>
              {upload.status === "uploading" && (
                <span className="row">
                  <span className="spinner" aria-hidden="true" />
                  Uploading
                </span>
              )}
              {upload.status === "pending" && <span className="subtle">Waiting</span>}
              {upload.status === "done" && (
                <span style={{ color: "var(--status-positive-fg)" }}>Uploaded</span>
              )}
              {upload.status === "error" && (
                <span style={{ color: "var(--status-danger-fg)" }} className="row">
                  <AlertTriangle size={13} />
                  {upload.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
