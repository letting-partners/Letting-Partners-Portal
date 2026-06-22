"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { listMediaLibrary, uploadMediaAssets, type MediaAssetRow } from "@/lib/portal-api";

export type MediaSelectionValue = {
  mediaAssetId: string;
  altText: string;
};

type Props = {
  selectedAssets: MediaSelectionValue[];
  onChange: (mediaAssets: MediaSelectionValue[]) => void;
  disabled?: boolean;
  required?: boolean;
};

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
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = dataUrl;
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

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to prepare image.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return {
    name: file.name,
    dataUrl: canvas.toDataURL("image/jpeg", 0.82),
  };
}

export function PropertyMediaLibrary({
  selectedAssets,
  onChange,
  disabled = false,
  required = false,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAssets() {
      setLoading(true);
      const result = await listMediaLibrary();
      if (!isMounted) {
        return;
      }

      setLoading(false);
      if (!result.ok) {
        setMessage({ type: "error", text: result.message ?? "Failed to load media library." });
        return;
      }

      setAssets(result.data.assets);
    }

    void loadAssets();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedAssetIds = useMemo(() => new Set(selectedAssets.map((asset) => asset.mediaAssetId)), [selectedAssets]);

  const sortedAssets = useMemo(() => {
    return [...assets].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [assets]);

  const selectedRows = useMemo(() => {
    return selectedAssets
      .map((selectedAsset) => {
        const asset = assets.find((candidate) => candidate.id === selectedAsset.mediaAssetId);
        if (!asset) return null;
        return { asset, selectedAsset };
      })
      .filter(Boolean) as Array<{ asset: MediaAssetRow; selectedAsset: MediaSelectionValue }>;
  }, [assets, selectedAssets]);

  function updateSelection(nextAssets: MediaSelectionValue[]) {
    onChange(nextAssets);
  }

  function toggleAsset(mediaAssetId: string) {
    if (disabled) {
      return;
    }

    if (selectedAssetIds.has(mediaAssetId)) {
      updateSelection(selectedAssets.filter((asset) => asset.mediaAssetId !== mediaAssetId));
      return;
    }

    const mediaAsset = assets.find((asset) => asset.id === mediaAssetId);
    updateSelection([
      ...selectedAssets,
      {
        mediaAssetId,
        altText: mediaAsset?.name?.trim() || "Property photo",
      },
    ]);
  }

  function updateAltText(mediaAssetId: string, altText: string) {
    updateSelection(
      selectedAssets.map((asset) =>
        asset.mediaAssetId === mediaAssetId ? { ...asset, altText } : asset,
      ),
    );
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (files.length > MAX_UPLOAD_FILES) {
      setMessage({
        type: "error",
        text: `Upload up to ${MAX_UPLOAD_FILES} images at a time.`,
      });
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setMessage({ type: "error", text: "Only image files can be uploaded." });
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setMessage({
          type: "error",
          text: `Each file must be smaller than ${Math.round(MAX_FILE_SIZE_BYTES / 1_000_000)} MB.`,
        });
        return;
      }
    }

    try {
      setUploading(true);
      setMessage(null);

      const optimizedFiles = await Promise.all(files.map((file) => optimizeImageFile(file)));
      const result = await uploadMediaAssets({ files: optimizedFiles });
      setUploading(false);

      if (!result.ok) {
        setMessage({ type: "error", text: result.message ?? "Failed to upload images." });
        return;
      }

      const uploadedAssets = result.data.assets;
      setAssets((current) => {
        const existing = new Map(current.map((asset) => [asset.id, asset]));
        for (const asset of uploadedAssets) {
          existing.set(asset.id, asset);
        }
        return Array.from(existing.values());
      });

      const appended = uploadedAssets.map<MediaSelectionValue>((asset) => ({
        mediaAssetId: asset.id,
        altText: asset.name?.trim() || "Property photo",
      }));

      updateSelection([
        ...selectedAssets,
        ...appended.filter((asset) => !selectedAssetIds.has(asset.mediaAssetId)),
      ]);

      setMessage({
        type: "success",
        text: uploadedAssets.length === 1 ? "Image uploaded and selected." : "Images uploaded and selected.",
      });
    } catch (error) {
      setUploading(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to prepare images.",
      });
    }
  }

  return (
    <div className="stack" style={{ gap: "0.85rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--text)" }}>Property Photos</p>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Upload photos once, then select the images that should appear on this property and add alt text for each one.
          </p>
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
          <UIButton
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
          >
            {uploading ? "Uploading..." : "Upload Photos"}
          </UIButton>
        </div>
      </div>

      {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : null}

      {required && selectedAssets.length === 0 ? (
        <UIAlert type="error">Select at least one image before saving the property.</UIAlert>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          fontSize: "0.82rem",
          color: "var(--text-muted)",
        }}
      >
        <span>{selectedAssets.length} image{selectedAssets.length === 1 ? "" : "s"} selected</span>
        <span>Uploaded images are optimized before saving.</span>
      </div>

      {selectedRows.length > 0 ? (
        <div className="stack" style={{ gap: "0.75rem" }}>
          {selectedRows.map(({ asset, selectedAsset }) => (
            <div
              key={asset.id}
              style={{
                display: "grid",
                gridTemplateColumns: "112px 1fr auto",
                gap: "0.75rem",
                alignItems: "start",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "0.75rem",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.dataUrl ?? asset.imageUrl}
                alt={selectedAsset.altText || asset.name}
                style={{
                  width: 112,
                  height: 84,
                  objectFit: "cover",
                  borderRadius: "0.55rem",
                  background: "#101016",
                }}
              />

              <div className="stack" style={{ gap: "0.5rem" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>{asset.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {new Date(asset.createdAt).toLocaleDateString("en-GB")}
                  </div>
                </div>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Alt text</span>
                  <UIInput
                    value={selectedAsset.altText}
                    onChange={(event) => updateAltText(asset.id, event.target.value)}
                    placeholder="Describe this photo"
                    disabled={disabled}
                  />
                </label>
              </div>

              <UIButton
                type="button"
                variant="secondary"
                onClick={() => toggleAsset(asset.id)}
                disabled={disabled}
              >
                Remove
              </UIButton>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: "1rem 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Loading media library...
        </div>
      ) : sortedAssets.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: "0.75rem",
            padding: "1rem",
            color: "var(--text-muted)",
            fontSize: "0.9rem",
          }}
        >
          No photos uploaded yet.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.85rem",
          }}
        >
          {sortedAssets.map((asset) => {
            const isSelected = selectedAssetIds.has(asset.id);

            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => toggleAsset(asset.id)}
                disabled={disabled}
                style={{
                  border: isSelected ? "2px solid var(--brand-gold)" : "1px solid var(--border)",
                  borderRadius: "0.85rem",
                  padding: "0.55rem",
                  background: isSelected ? "rgba(201,168,76,0.12)" : "var(--surface-alt, #1a1a24)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                  textAlign: "left",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.dataUrl ?? asset.imageUrl}
                  alt={asset.name}
                  style={{
                    width: "100%",
                    aspectRatio: "4 / 3",
                    objectFit: "cover",
                    borderRadius: "0.6rem",
                    background: "#101016",
                  }}
                />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "0.84rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {asset.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {new Date(asset.createdAt).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                  <span
                    style={{
                      minWidth: 28,
                      height: 28,
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: isSelected ? "none" : "1px solid var(--border)",
                      background: isSelected ? "var(--brand-gold)" : "transparent",
                      color: isSelected ? "#151515" : "var(--text-muted)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    {isSelected ? "On" : "+"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}