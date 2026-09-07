"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Star, Trash2 } from "lucide-react";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { EmptyState } from "@/components/ui/layout";
import { useToast } from "@/components/ui/Toast";
import { detachImageAction, setCoverImageAction } from "@/app/actions/images";

/**
 * Photos on a property: upload, choose the cover, remove.
 *
 * Detaching an image leaves it in the shared library, because the same photo
 * is often reused on another listing.
 */
export default function PropertyPhotos({
  propertyId,
  images,
  canEdit,
}: {
  propertyId: string;
  images: { assetId: string; url: string; altText: string | null; fileName: string; isCover: boolean }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function run(
    assetId: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setBusyId(assetId);
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="stack">
      {images.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={18} />}
          title="No photos yet"
          message="A listing needs at least one photo before it can go on the website."
        />
      ) : (
        <div className="image-grid">
          {images.map((image) => (
            <figure key={image.assetId} className="image-tile">
              <img src={image.url} alt={image.altText ?? ""} loading="lazy" />

              <figcaption className="image-tile-bar">
                <span className="truncate">{image.altText ?? image.fileName}</span>

                {canEdit ? (
                  <span className="row">
                    {!image.isCover && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon btn--sm"
                        style={{ color: "#fff" }}
                        aria-label="Make this the cover photo"
                        disabled={pending && busyId === image.assetId}
                        onClick={() =>
                          run(
                            image.assetId,
                            () => setCoverImageAction(image.assetId, propertyId),
                            "Cover photo updated.",
                          )
                        }
                      >
                        <Star size={13} />
                      </button>
                    )}
                    {image.isCover && <span className="badge badge--positive">Cover</span>}
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon btn--sm"
                      style={{ color: "#fff" }}
                      aria-label="Remove from this property"
                      disabled={pending && busyId === image.assetId}
                      onClick={() =>
                        run(
                          image.assetId,
                          () => detachImageAction(image.assetId, propertyId),
                          "Removed from this property. It is still in the library.",
                        )
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                ) : (
                  image.isCover && <span className="badge badge--positive">Cover</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {canEdit && <ImageUploader propertyId={propertyId} compact />}
    </div>
  );
}
