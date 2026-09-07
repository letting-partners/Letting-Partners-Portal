"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { markAllReadAction } from "./actions";

/** Clears every unread notification for the signed-in user. */
export default function MarkAllRead() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn--secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markAllReadAction();
          router.refresh();
        })
      }
    >
      {pending && <span className="spinner" aria-hidden="true" />}
      <CheckCheck size={15} />
      Mark all read
    </button>
  );
}
