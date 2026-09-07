"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ExternalLink, Globe, GlobeLock, KeyRound } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { archiveAction, publishAction, unpublishAction } from "../actions";

/** Primary actions in the property detail header. */
export default function PropertyHeaderActions({
  propertyId,
  listingStatus,
  dealStage,
  slug,
  siteUrl,
  canPublish,
  canArchive,
  canStartViewing,
  publishReady,
  publishMissing,
}: {
  propertyId: string;
  listingStatus: string;
  dealStage: string;
  slug: string | null;
  siteUrl: string;
  canPublish: boolean;
  canArchive: boolean;
  canStartViewing: boolean;
  publishReady: boolean;
  publishMissing: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"unpublish" | "archive" | null>(null);

  const isPublished = listingStatus === "PUBLISHED";
  const pipelineBusy =
    dealStage === "VIEWING" || dealStage === "VERIFICATION" || dealStage === "CLOSING";

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
      {isPublished && slug && (
        <a
          href={`${siteUrl}/properties/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn--ghost"
        >
          <ExternalLink size={15} />
          View on website
        </a>
      )}

      {canStartViewing && (
        <Link href={`/viewings/new?propertyId=${propertyId}`} className="btn btn--secondary">
          <KeyRound size={15} />
          Start viewing
        </Link>
      )}

      {canPublish && !isPublished && (
        <button
          type="button"
          className="btn btn--primary"
          disabled={pending || !publishReady}
          title={publishReady ? undefined : `Still needed: ${publishMissing.join(", ")}`}
          onClick={() => run(() => publishAction(propertyId), "Published to the website.")}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          <Globe size={15} />
          Publish to web
        </button>
      )}

      {canPublish && isPublished && (
        <button
          type="button"
          className="btn btn--secondary"
          disabled={pending}
          onClick={() => setConfirm("unpublish")}
        >
          <GlobeLock size={15} />
          Unpublish
        </button>
      )}

      {canArchive && (
        <button
          type="button"
          className="btn btn--ghost"
          disabled={pending || pipelineBusy}
          title={pipelineBusy ? "Close or cancel the live deal first" : undefined}
          onClick={() => setConfirm("archive")}
        >
          <Archive size={15} />
          Archive
        </button>
      )}

      <ConfirmDialog
        open={confirm === "unpublish"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run(() => unpublishAction(propertyId), "Removed from the website.")}
        title="Unpublish this listing?"
        message="It will disappear from the public website immediately. Everything in the portal stays exactly as it is, and you can publish it again whenever you want."
        confirmLabel="Unpublish"
        pending={pending}
      />

      <ConfirmDialog
        open={confirm === "archive"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run(() => archiveAction(propertyId), "Property archived.")}
        title="Archive this property?"
        message="It will be hidden from lists and taken off the website. Nothing is deleted - its calls, deals, sales and commission history are kept, and an administrator can restore it."
        confirmLabel="Archive"
        danger
        pending={pending}
      />
    </>
  );
}
