"use client";

import { ChangeEvent, useRef, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import {
  uploadMediaAssets,
  updateMediaAssetName,
  deleteMediaAsset,
  type MediaAssetRow,
} from "@/lib/portal-api";

const MAX_UPLOAD_FILES = 10;
const MAX_FILE_SIZE_BYTES = 8_000_000;
const MAX_IMAGE_DIMENSION = 1600;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = dataUrl;
  });
}

async function optimizeImageFile(file: File): Promise<{ name: string; dataUrl: string }> {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const longestSide = Math.max(image.width, image.height);
  const scale = longestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longestSide : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to prepare image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  return { name: file.name, dataUrl: canvas.toDataURL("image/jpeg", 0.82) };
}

type Props = {
  initialAssets: MediaAssetRow[];
};

export function MediaLibraryClient({ initialAssets }: Props) {
  const [assets, setAssets] = useState<MediaAssetRow[]>(initialAssets);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = assets
    .filter((a) => !search.trim() || a.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    if (files.length > MAX_UPLOAD_FILES) {
      setMessage({ type: "error", text: `Upload up to ${MAX_UPLOAD_FILES} images at a time.` });
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setMessage({ type: "error", text: "Only image files can be uploaded." });
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setMessage({ type: "error", text: "Each file must be smaller than 8 MB." });
        return;
      }
    }

    try {
      setUploading(true);
      setMessage(null);
      const optimized = await Promise.all(files.map(optimizeImageFile));
      const result = await uploadMediaAssets({ files: optimized });
      setUploading(false);

      if (!result.ok) {
        setMessage({ type: "error", text: result.message ?? "Failed to upload images." });
        return;
      }

      const uploaded = result.data.assets;
      setAssets((prev) => {
        const map = new Map(prev.map((a) => [a.id, a]));
        for (const a of uploaded) map.set(a.id, a);
        return Array.from(map.values());
      });

      setMessage({
        type: "success",
        text: `${uploaded.length} image${uploaded.length !== 1 ? "s" : ""} uploaded successfully.`,
      });
    } catch (err) {
      setUploading(false);
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to prepare images.",
      });
    }
  }

  function startEdit(asset: MediaAssetRow) {
    setEditingId(asset.id);
    setEditingName(asset.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveEdit(assetId: string) {
    const name = editingName.trim();
    if (!name) return;
    setSavingId(assetId);
    const result = await updateMediaAssetName(assetId, name);
    setSavingId(null);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update image." });
      return;
    }

    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, name: result.data.asset.name } : a)),
    );
    setEditingId(null);
    setMessage({ type: "success", text: "Alt text updated." });
  }

  async function handleDelete(asset: MediaAssetRow) {
    if (!window.confirm(`Delete "${asset.name}"? This will remove it from all properties.`)) return;

    setDeletingId(asset.id);
    setMessage(null);
    const result = await deleteMediaAsset(asset.id);
    setDeletingId(null);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to delete image." });
      return;
    }

    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    setMessage({ type: "success", text: `"${asset.name}" deleted.` });
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Media Library</h1>
          <p className="page-subtitle">{assets.length} image{assets.length !== 1 ? "s" : ""} in library</p>
        </div>
        <div className="inline-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <UIButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload Photos"}
          </UIButton>
        </div>
      </header>

      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <div style={{ maxWidth: 320 }}>
        <UIInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search images by name..."
        />
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: "0.75rem",
            padding: "3rem 2rem",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          {search ? "No images match your search." : "No images uploaded yet. Use the Upload Photos button to get started."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          {filtered.map((asset) => {
            const isEditing = editingId === asset.id;
            const isSaving = savingId === asset.id;
            const isDeleting = deletingId === asset.id;

            return (
              <div
                key={asset.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "0.85rem",
                  overflow: "hidden",
                  background: "var(--surface-alt, #1a1a24)",
                  display: "flex",
                  flexDirection: "column",
                  opacity: isDeleting ? 0.5 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {/* Thumbnail */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.dataUrl ?? asset.imageUrl}
                  alt={asset.name}
                  style={{
                    width: "100%",
                    aspectRatio: "4/3",
                    objectFit: "cover",
                    display: "block",
                    background: "#101016",
                  }}
                />

                {/* Info + controls */}
                <div className="stack" style={{ gap: "0.6rem", padding: "0.75rem" }}>
                  {isEditing ? (
                    <div className="stack" style={{ gap: "0.4rem" }}>
                      <UIInput
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        placeholder="Alt text / file name"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveEdit(asset.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <div className="inline-row" style={{ gap: "0.4rem" }}>
                        <UIButton
                          type="button"
                          onClick={() => void saveEdit(asset.id)}
                          disabled={isSaving || !editingName.trim()}
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </UIButton>
                        <UIButton type="button" variant="secondary" onClick={cancelEdit} disabled={isSaving}>
                          Cancel
                        </UIButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.86rem",
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={asset.name}
                        >
                          {asset.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                          {new Date(asset.createdAt).toLocaleDateString("en-GB")}
                          {asset.uploadedBy?.agentDisplayName
                            ? ` · ${asset.uploadedBy.agentDisplayName}`
                            : null}
                        </div>
                      </div>

                      <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: 0 }}>
                        Alt text
                      </label>

                      <div className="inline-row" style={{ gap: "0.4rem" }}>
                        <UIButton
                          type="button"
                          variant="secondary"
                          onClick={() => startEdit(asset)}
                          disabled={isDeleting}
                          style={{ flex: 1 }}
                        >
                          Edit Alt Text
                        </UIButton>
                        <UIButton
                          type="button"
                          variant="danger"
                          onClick={() => void handleDelete(asset)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? "..." : "Delete"}
                        </UIButton>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
