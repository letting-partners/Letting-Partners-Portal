"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deleteCallAction } from "./actions";

/**
 * Deleting a call attempt. Shown to administrators only.
 *
 * The log is meant to be permanent, so this is for entries that should never
 * have been in it - a mis-dial, a test, a number typed wrong. A call that
 * produced a property is refused by the server, which says so.
 */
export default function CallRowActions({
  callId,
  label,
}: {
  callId: string;
  /** How the call is named in the confirmation, so the right row is obvious. */
  label: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    startTransition(async () => {
      const result = await deleteCallAction(callId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Call deleted.");
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <>
      <RowMenu label="Call actions">
        <button
          type="button"
          className="menu-item menu-item--danger"
          role="menuitem"
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={15} />
          Delete
        </button>
      </RowMenu>

      <ConfirmDialog
        open={confirming}
        title="Delete this call?"
        message={`${label} is removed from the log for everyone. Anything the call led to - a follow-up, a not-interested record - stays where it is.`}
        confirmLabel="Delete"
        danger
        pending={pending}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
      />
    </>
  );
}
