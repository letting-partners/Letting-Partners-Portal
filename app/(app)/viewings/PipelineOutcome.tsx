"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  closeDealAction,
  completeVerificationAction,
  completeViewingAction,
} from "./actions";

/**
 * Records the outcome of a pipeline stage.
 *
 * Failure always asks for a reason and never ends the deal: an unsuccessful
 * viewing, verification or closing walks the deal back so another attempt can
 * be made, and every attempt stays on the record.
 */

export type Stage = "VIEWING" | "VERIFICATION" | "CLOSING";

const COPY: Record<
  Stage,
  {
    successLabel: string;
    failLabel: string;
    successTitle: string;
    successMessage: string;
    failTitle: string;
    failMessage: string;
    reasonPlaceholder: string;
  }
> = {
  VIEWING: {
    successLabel: "Successful",
    failLabel: "Not successful",
    successTitle: "Mark this viewing successful?",
    successMessage:
      "The deal moves on to verification. The property stays exactly where it is on the website.",
    failTitle: "Why was the viewing not successful?",
    failMessage:
      "The deal stays open and the property becomes available again, so another viewing or another tenant can be tried. This attempt is kept on the record.",
    reasonPlaceholder: "Tenant did not like the property, price, location, no-show...",
  },
  VERIFICATION: {
    successLabel: "Verification successful",
    failLabel: "Verification failed",
    successTitle: "Mark verification successful?",
    successMessage: "The deal moves on to closing.",
    failTitle: "Why did verification fail?",
    failMessage:
      "The deal returns to viewing rather than being lost. Every verification attempt is kept.",
    reasonPlaceholder: "References, affordability, landlord declined...",
  },
  CLOSING: {
    successLabel: "Closed",
    failLabel: "Did not close",
    successTitle: "Close this deal?",
    successMessage:
      "This creates the sale, calculates and freezes the commission, and marks the property or room as let. It cannot be undone.",
    failTitle: "Why did the deal not close?",
    failMessage:
      "The deal returns to the pipeline so it can be picked back up. Nothing is deleted.",
    reasonPlaceholder: "Tenant withdrew, landlord withdrew, terms not agreed...",
  },
};

export default function PipelineOutcome({
  stage,
  dealId,
  viewingId,
  propertyId,
  compact = false,
}: {
  stage: Stage;
  dealId: string;
  viewingId?: string;
  propertyId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"success" | "fail" | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[stage];
  const buttonSize = compact ? "btn--sm" : "";

  function submit(successful: boolean) {
    setError(null);

    startTransition(async () => {
      const result =
        stage === "VIEWING"
          ? await completeViewingAction({
              viewingId: viewingId!,
              successful,
              reason: successful ? null : reason,
              notes: notes || null,
              propertyId,
            })
          : stage === "VERIFICATION"
            ? await completeVerificationAction({
                dealId,
                successful,
                reason: successful ? null : reason,
                notes: notes || null,
                propertyId,
              })
            : await closeDealAction({
                dealId,
                closed: successful,
                reason: successful ? null : reason,
                notes: notes || null,
                propertyId,
              });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDialog(null);
      setReason("");
      setNotes("");

      if (stage === "CLOSING" && successful && "saleId" in result.data && result.data.saleId) {
        toast.success("Deal closed. Sale and commission recorded.");
        router.push(`/sales/${result.data.saleId}`);
        return;
      }

      toast.success(
        successful
          ? stage === "VIEWING"
            ? "Viewing successful. The deal is now in verification."
            : "Verification successful. The deal is now closing."
          : "Recorded. The deal stays open for another attempt.",
      );
      router.refresh();
    });
  }

  return (
    <>
      <div className="row">
        <button
          type="button"
          className={`btn btn--secondary ${buttonSize}`.trim()}
          onClick={() => setDialog("success")}
          disabled={pending}
        >
          <Check size={14} />
          {copy.successLabel}
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${buttonSize}`.trim()}
          onClick={() => setDialog("fail")}
          disabled={pending}
        >
          <X size={14} />
          {copy.failLabel}
        </button>
      </div>

      <Modal
        open={dialog === "success"}
        onClose={() => setDialog(null)}
        title={copy.successTitle}
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setDialog(null)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => submit(true)}
              disabled={pending}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              {copy.successLabel}
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

          <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>{copy.successMessage}</p>

          <div className="field">
            <label className="field-label" htmlFor={`notes-success-${dealId}`}>
              Notes
            </label>
            <textarea
              id={`notes-success-${dealId}`}
              className="textarea"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={dialog === "fail"}
        onClose={() => setDialog(null)}
        title={copy.failTitle}
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setDialog(null)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => submit(false)}
              disabled={pending || !reason.trim()}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Record outcome
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

          <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>{copy.failMessage}</p>

          <div className="field">
            <label className="field-label" htmlFor={`reason-${dealId}`}>
              Reason<span className="required">*</span>
            </label>
            <input
              id={`reason-${dealId}`}
              className="input"
              value={reason}
              placeholder={copy.reasonPlaceholder}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`notes-fail-${dealId}`}>
              Notes
            </label>
            <textarea
              id={`notes-fail-${dealId}`}
              className="textarea"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
