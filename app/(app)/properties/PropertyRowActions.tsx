"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleSlash,
  Eye,
  Globe,
  GlobeLock,
  Pencil,
  RotateCcw,
  Star,
  StarOff,
  Trash2,
  UserCog,
} from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import ReassignDialog, { type AssignablePerson } from "@/components/ui/ReassignDialog";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  archiveAction,
  publishAction,
  reassignPropertyAction,
  setAvailabilityAction,
  setFeaturedAction,
  unpublishAction,
} from "./actions";

/** Per-row actions for the properties table. */
export default function PropertyRowActions({
  propertyId,
  listingStatus,
  isFeatured,
  isAdmin = false,
  agents = [],
  fronters = [],
  assignedAgentId,
  originatingFronterId,
  label,
}: {
  propertyId: string;
  listingStatus: string;
  isFeatured: boolean;
  isAdmin?: boolean;
  agents?: AssignablePerson[];
  fronters?: AssignablePerson[];
  assignedAgentId?: string | null;
  originatingFronterId?: string | null;
  label?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"unpublish" | "archive" | null>(null);
  const [reassigning, setReassigning] = useState(false);

  const isPublished = listingStatus === "PUBLISHED";
  const isDraft = listingStatus === "DRAFT";
  // Let agreed is still on the website, just marked as gone.
  const isLetAgreed = listingStatus === "LET_AGREED";
  const isLive = isPublished || isLetAgreed;

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

        {isLive && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            disabled={pending}
            onClick={() =>
              run(
                () => setAvailabilityAction(propertyId, isLetAgreed),
                isLetAgreed ? "Marked available." : "Marked unavailable on the website.",
              )
            }
          >
            {isLetAgreed ? <RotateCcw size={15} /> : <CircleSlash size={15} />}
            {isLetAgreed ? "Mark available" : "Mark unavailable"}
          </button>
        )}

        {isLive && (
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

        {isAdmin && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => setReassigning(true)}
          >
            <UserCog size={15} />
            Reassign
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

      <ReassignDialog
        open={reassigning}
        onClose={() => setReassigning(false)}
        label={label ?? "this property"}
        agents={agents}
        fronters={fronters}
        currentAgentId={assignedAgentId}
        currentFronterId={originatingFronterId}
        onSubmit={(next, reason) => reassignPropertyAction(propertyId, next, reason)}
      />

      <ConfirmDialog
        open={confirm === "unpublish"}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          run(() => unpublishAction(propertyId), "Removed from the website.")
        }
        title="Unpublish this listing?"
        message="The page is removed from the website, so its link stops working and any search ranking it had earned is lost. If it is simply let, use Mark unavailable instead - that keeps the page and says so."
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
