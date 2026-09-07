"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { setUserStatusAction } from "./actions";

/** Activate or deactivate a staff account. */
export default function UserRowActions({
  userId,
  fullName,
  status,
  isSelf,
}: {
  userId: string;
  fullName: string;
  status: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const isActive = status === "ACTIVE";

  function change(next: "ACTIVE" | "INACTIVE") {
    startTransition(async () => {
      const result = await setUserStatusAction(userId, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        next === "ACTIVE" ? `${fullName} can sign in again.` : `${fullName} has been deactivated.`,
      );
      setConfirm(false);
      router.refresh();
    });
  }

  return (
    <>
      <RowMenu label={`Actions for ${fullName}`}>
        {isActive ? (
          <button
            type="button"
            className="menu-item menu-item--danger"
            role="menuitem"
            disabled={pending || isSelf}
            title={isSelf ? "You cannot deactivate your own account" : undefined}
            onClick={() => setConfirm(true)}
          >
            <Ban size={15} />
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            disabled={pending}
            onClick={() => change("ACTIVE")}
          >
            <RotateCcw size={15} />
            Reactivate
          </button>
        )}
      </RowMenu>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => change("INACTIVE")}
        title={`Deactivate ${fullName}?`}
        message="They will be signed out of every device immediately and will not be able to request a new sign-in code. All of their records, calls and commission history are kept, and you can reactivate them at any time."
        confirmLabel="Deactivate"
        danger
        pending={pending}
      />
    </>
  );
}
