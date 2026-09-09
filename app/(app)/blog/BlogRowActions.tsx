"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import { useToast } from "@/components/ui/Toast";
import { setBlogStatusAction } from "./actions";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.lettingpartners.co.uk";

/** Per-row actions for the blog list. */
export default function BlogRowActions({
  postId,
  slug,
  title,
  status,
}: {
  postId: string;
  slug: string;
  title: string;
  status: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function move(next: "DRAFT" | "PUBLISHED" | "TRASHED", message: string) {
    startTransition(async () => {
      const result = await setBlogStatusAction(postId, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      router.refresh();
    });
  }

  const isPublished = status === "PUBLISHED";
  const isTrashed = status === "TRASHED";

  return (
    <RowMenu label={`Actions for ${title}`}>
      <Link href={`/blog/${postId}`} className="menu-item" role="menuitem">
        <Pencil size={15} />
        Edit
      </Link>

      {isPublished && (
        <a
          className="menu-item"
          role="menuitem"
          href={`${SITE_URL}/blog/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={15} />
          View on the website
        </a>
      )}

      {!isPublished && (
        <button
          type="button"
          className="menu-item"
          role="menuitem"
          disabled={pending}
          onClick={() => move("PUBLISHED", "Article published.")}
        >
          <Send size={15} />
          {isTrashed ? "Restore and publish" : "Publish"}
        </button>
      )}

      {isPublished && (
        <button
          type="button"
          className="menu-item"
          role="menuitem"
          disabled={pending}
          onClick={() => move("DRAFT", "Reverted to draft.")}
        >
          <Undo2 size={15} />
          Revert to draft
        </button>
      )}

      {isTrashed && (
        <button
          type="button"
          className="menu-item"
          role="menuitem"
          disabled={pending}
          onClick={() => move("DRAFT", "Restored as a draft.")}
        >
          <RotateCcw size={15} />
          Restore as draft
        </button>
      )}

      {!isTrashed && (
        <>
          <div className="menu-separator" />
          <button
            type="button"
            className="menu-item menu-item--danger"
            role="menuitem"
            disabled={pending}
            onClick={() => move("TRASHED", "Moved to trash.")}
          >
            <Trash2 size={15} />
            Move to trash
          </button>
        </>
      )}
    </RowMenu>
  );
}
