"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";

export function NavLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await apiPost("/api/auth/logout", {});
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} disabled={busy} className="nav-logout-btn">
      {busy ? "Signing out…" : "Sign Out"}
    </button>
  );
}
