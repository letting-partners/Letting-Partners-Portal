"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, PhoneCall, X } from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import { useStartCall } from "@/components/calls/StartCall";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  cancelFollowUpAction,
  completeFollowUpAction,
  rescheduleFollowUpAction,
} from "./actions";

/** Row actions for a scheduled follow-up. */
export default function FollowUpRowActions({
  followUpId,
  normalizedPhone,
  status,
  canRetry,
  isOwner,
  dueAt,
}: {
  followUpId: string;
  normalizedPhone: string;
  status: string;
  canRetry: boolean;
  isOwner: boolean;
  dueAt: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const startCall = useStartCall();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | null>(null);
  const [newDueAt, setNewDueAt] = useState(toLocalInput(dueAt));
  const [reason, setReason] = useState("");

  const isScheduled = status === "SCHEDULED";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success(success);
      setDialog(null);
      router.refresh();
    });
  }

  return (
    <>
      <RowMenu label="Follow-up actions">
        {canRetry && isScheduled && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => startCall.open({ phone: normalizedPhone, followUpId })}
          >
            <PhoneCall size={15} />
            {isOwner ? "Continue follow up" : "Override and call"}
          </button>
        )}

        {isScheduled && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            disabled={pending || !canRetry}
            onClick={() => setDialog("reschedule")}
          >
            <CalendarClock size={15} />
            Reschedule
          </button>
        )}

        {isScheduled && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            disabled={pending || !canRetry}
            onClick={() =>
              run(() => completeFollowUpAction(followUpId), "Follow-up completed.")
            }
          >
            <Check size={15} />
            Mark complete
          </button>
        )}

        {isScheduled && (
          <>
            <div className="menu-separator" />
            <button
              type="button"
              className="menu-item menu-item--danger"
              role="menuitem"
              disabled={pending || !canRetry}
              onClick={() => setDialog("cancel")}
            >
              <X size={15} />
              Cancel follow up
            </button>
          </>
        )}

        {!isScheduled && (
          <Link
            href={`/calls?q=${encodeURIComponent(normalizedPhone)}`}
            className="menu-item"
            role="menuitem"
          >
            View history
          </Link>
        )}
      </RowMenu>

      <Modal
        open={dialog === "reschedule"}
        onClose={() => setDialog(null)}
        title="Reschedule follow up"
        description="The number stays locked to the owner until the follow-up is completed or cancelled."
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
              disabled={pending || !newDueAt}
              onClick={() =>
                run(
                  () => rescheduleFollowUpAction(followUpId, newDueAt, reason || null),
                  "Follow-up rescheduled.",
                )
              }
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Reschedule
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="field">
            <label className="field-label" htmlFor={`due-${followUpId}`}>
              New date and time
            </label>
            <input
              id={`due-${followUpId}`}
              type="datetime-local"
              className="input"
              value={newDueAt}
              onChange={(event) => setNewDueAt(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`note-${followUpId}`}>
              Note
            </label>
            <textarea
              id={`note-${followUpId}`}
              className="textarea"
              rows={3}
              value={reason}
              placeholder="Added to the existing notes, not replacing them."
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Cancel this follow up?"
        description="The number is released and anyone may call it again. Nothing is deleted."
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setDialog(null)}
              disabled={pending}
            >
              Keep it
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={pending || !reason.trim()}
              onClick={() =>
                run(() => cancelFollowUpAction(followUpId, reason), "Follow-up cancelled.")
              }
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Cancel follow up
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor={`cancel-${followUpId}`}>
            Reason<span className="required">*</span>
          </label>
          <textarea
            id={`cancel-${followUpId}`}
            className="textarea"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this follow-up no longer needed?"
          />
        </div>
      </Modal>
    </>
  );
}

/** ISO timestamp to the value a datetime-local input expects. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
