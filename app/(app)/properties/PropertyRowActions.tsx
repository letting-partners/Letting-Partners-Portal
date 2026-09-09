"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Globe, GlobeLock, Pencil, Star, StarOff, Trash2 } from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { archiveAction, publishAction, setFeaturedAction, unpublishAction } from "./actions";

/** Per-row actions for the properties table. */
export default function PropertyRowActions({
  propertyId,
  listingStatus,
  isFeatured,
}: {
  propertyId: string;
  listingStatus: string;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"unpublish" | "archive" | null>(null);

  const isPublished = listingStatus === "PUBLISHED";
  const isDraft = listingStatus === "DRAFT";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success(success);
      setConfirm(null);
      router.refresh();
    });
  }

  return (
    <>
      <RowMenu label="Property actions">
        <Link href={`/properties/${propertyId}`} className="menu-item" role="menuitem">
          <Eye size={15} />
          View
        </Link>

        <Link href={`/properties/${propertyId}?tab=listing`} className="menu-item" role="menuitem">
          <Pencil size={15} />
          {isDraft ? "Complete details" : "Edit details"}
        </Link>

        {!isPublished && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            disabled={pending}
            onClick={() =>
              run(() => publishAction(propertyId), "Published to the website.")
            }
          >
            <Globe size={15} />
            Publish to web
          </button>
        )}

        {isPublished && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            disabled={pending}
            onClick={() => setConfirm("unpublish")}
          >
            <GlobeLock size={15} />
            Unpublish
          </button>
        )}

        {/* Featuring only means something once the listing is public. */}
        {isPublished && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            disabled={pending}
            onClick={() =>
              run(
                () => setFeaturedAction(propertyId, !isFeatured),
                isFeatured ? "Removed from the home page." : "Featured on the home page.",
              )
            }
          >
            {isFeatured ? <StarOff size={15} /> : <Star size={15} />}
            {isFeatured ? "Unfeature" : "Feature on home"}
          </button>
        )}

        <div className="menu-separator" />

        <button
          type="button"
          className="menu-item menu-item--danger"
          role="menuitem"
          disabled={pending}
          onClick={() => setConfirm("archive")}
        >
          <Trash2 size={15} />
          Delete
        </button>
      </RowMenu>

      <ConfirmDialog
        open={confirm === "unpublish"}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          run(() => unpublishAction(propertyId), "Removed from the website.")
        }
        title="Unpublish this listing?"
        message="It will be removed from the public website immediately. The record and all of its history stay in the portal, and you can publish it again at any time."
        confirmLabel="Unpublish"
        pending={pending}
      />

      <ConfirmDialog
        open={confirm === "archive"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run(() => archiveAction(propertyId), "Property deleted.")}
        title="Delete this property?"
        message="It will be hidden from lists and removed from the website. The record is archived rather than erased, so its calls, deals and sales history stay intact and an administrator can restore it."
        confirmLabel="Delete"
        danger
        pending={pending}
      />
    </>
  );
}
