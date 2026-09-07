"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, KeyRound, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { respondToCollaborationAction } from "../cross-sell/actions";

/** Accept or decline a cross-sell request, or book the viewing once accepted. */
export default function CollaborationActions({
  collaborationId,
  propertyId,
  canRespond,
  canStartViewing,
}: {
  collaborationId: string;
  propertyId: string;
  canRespond: boolean;
  canStartViewing: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function respond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondToCollaborationAction(
        collaborationId,
        accept,
        accept ? null : reason,
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(accept ? "Cross-sell accepted." : "Request declined.");
      setDeclineOpen(false);
      setReason("");
      router.refresh();
    });
  }

  if (canStartViewing) {
    return (
      <Link href={`/viewings/new?propertyId=${propertyId}`} className="btn btn--primary btn--sm">
        <KeyRound size={14} />
        Book viewing
      </Link>
    );
  }

  if (!canRespond) return null;

  return (
    <>
      <div className="row">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => respond(true)}
          disabled={pending}
        >
          <Check size={14} />
          Accept
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setDeclineOpen(true)}
          disabled={pending}
        >
          <X size={14} />
          Decline
        </button>
      </div>

      <Modal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Decline this request?"
        description="The requesting agent will see your reason."
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setDeclineOpen(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => respond(false)}
              disabled={pending || !reason.trim()}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Decline
            </button>
          </>
        }
      >
        <div className="stack">
          {error && (
            <div className="alert alert--danger" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor={`decline-${collaborationId}`}>
              Reason<span className="required">*</span>
            </label>
            <textarea
              id={`decline-${collaborationId}`}
              className="textarea"
              rows={3}
              value={reason}
              placeholder="Already under offer, not a fit for the house share, landlord preference..."
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
