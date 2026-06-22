"use client";

import { useState } from "react";
import { PhoneLookupModal } from "./phone-lookup-modal";

export function DashboardLookupWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <p className="section-label" style={{ marginBottom: "0.5rem" }}>Start a Call</p>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0 0 0.9rem" }}>
        Look up a phone number before calling to check availability and log the outcome.
      </p>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Start a Call
      </button>
      <PhoneLookupModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
