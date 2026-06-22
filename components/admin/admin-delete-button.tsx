"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  label: string;
  confirmMessage: string;
  deleteUrl: string;
  redirectTo?: string;
};

export function AdminDeleteButton({ label, confirmMessage, deleteUrl, redirectTo }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(deleteUrl, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { message?: string }).message ?? "Delete failed.");
        setDeleting(false);
        return;
      }
      setOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      <button className="btn btn-danger" onClick={() => { setOpen(true); setError(null); }}>
        {label}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setOpen(false); }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "1.75rem",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
              Confirm Delete
            </h3>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              {confirmMessage}
            </p>
            {error && (
              <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "var(--danger)", background: "var(--danger-light)", padding: "0.5rem 0.75rem", borderRadius: "0.4rem" }}>
                {error}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
