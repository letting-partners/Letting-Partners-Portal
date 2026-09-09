"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Trash2 } from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cancelDealAction } from "./actions";

/**
 * Row actions for a deal in the viewing, verification or closing lists.
 *
 * Those rows are stages of one deal, so "delete" here cancels the deal rather
 * than removing a stage and leaving the rest of it pointing at nothing. The
 * unit is freed for someone else and the attempt stays on the record, which is
 * what makes a fronter's earlier work still visible.
 *
 * A reason is required: an admin ending another agent's deal should have to
 * say why, and that reason lands in the deal's stage history.
 */
export default function DealRowActions({
  dealId,
  propertyId,
  label,
  isAdmin,
}: {
  dealId: string;
  propertyId?: string | null;
  label: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  function cancel() {
    startTransition(async () => {
      const result = await cancelDealAction(dealId, reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Deal cancelled.");
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <RowMenu label={`Actions for ${label}`}>
        {propertyId && (
          <Link href={`/properties/${propertyId}`} className="menu-item" role="menuitem">
            <Eye size={15} />
            View property
          </Link>
        )}

        {isAdmin && (
          <button
            type="button"
            className="menu-item menu-item--danger"
            role="menuitem"
            onClick={() => setOpen(true)}
          >
            <Trash2 size={15} />
            Cancel deal
          </button>
        )}
      </RowMenu>

      <Modal
        open={open}
        title="Cancel this deal?"
        description="The unit is freed for another tenant. The deal and everything that led to it stay on the record."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={cancel}
              disabled={pending || !reason.trim()}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Cancel deal
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor={`cancel-reason-${dealId}`}>
            Reason<span className="required">*</span>
          </label>
          <textarea
            id={`cancel-reason-${dealId}`}
            className="input"
            rows={3}
            placeholder="Tenant withdrew, landlord let it privately, duplicate deal..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="field-hint">Recorded against the deal&apos;s stage history.</span>
        </div>
      </Modal>
    </>
  );
}
