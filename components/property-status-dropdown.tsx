"use client";

import { useEffect, useState } from "react";
import { updateProperty, type PropertyStatus } from "@/lib/portal-api";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: "Available", cls: "badge-active" },
  DRAFT: { label: "Draft", cls: "badge-draft" },
  CLOSED: { label: "Closed", cls: "badge-sold" },
};

const SELECTABLE_STATUSES: PropertyStatus[] = ["DRAFT", "AVAILABLE"];

type FeedbackMessage = {
  type: "success" | "error";
  text: string;
};

type Props = {
  propertyId: string;
  status: string;
  onUpdated?: (newStatus: string) => void;
  onMessage?: (message: FeedbackMessage) => void;
};

export function PropertyStatusDropdown({ propertyId, status, onUpdated, onMessage }: Props) {
  const [current, setCurrent] = useState(status);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrent(status);
  }, [status]);

  const cfg = STATUS_CONFIG[current] ?? { label: current, cls: "badge-draft" };

  if (current === "CLOSED") {
    return <span className="badge badge-sold">Closed</span>;
  }

  async function handleSelect(newStatus: PropertyStatus) {
    if (newStatus === current) {
      setOpen(false);
      return;
    }

    setSaving(true);
    const result = await updateProperty(propertyId, { status: newStatus });
    setSaving(false);
    setOpen(false);

    if (!result.ok) {
      onMessage?.({ type: "error", text: result.message ?? "Failed to update property status." });
      return;
    }

    if (result.data.approvalRequired) {
      onMessage?.({
        type: "success",
        text: result.data.message ?? "Status change submitted for admin approval.",
      });
      return;
    }

    setCurrent(newStatus);
    onUpdated?.(newStatus);
  }

  return (
    <div className="property-status-dropdown">
      <button
        type="button"
        className={`property-status-dropdown-trigger badge ${cfg.cls}`}
        onClick={() => {
          if (!saving) setOpen((value) => !value);
        }}
        title="Change property status"
      >
        <span>{saving ? "Saving..." : cfg.label}</span>
        {!saving ? <span className="property-status-dropdown-caret">v</span> : null}
      </button>

      {open ? (
        <>
          <div className="property-status-dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="property-status-dropdown-menu">
            {SELECTABLE_STATUSES.map((option) => {
              const optionCfg = STATUS_CONFIG[option];
              return (
                <button
                  key={option}
                  type="button"
                  className={`property-status-dropdown-item${option === current ? " is-active" : ""}`}
                  onClick={() => void handleSelect(option)}
                >
                  <span className={`property-status-dropdown-pill badge ${optionCfg.cls}`}>{optionCfg.label}</span>
                  {option === current ? <span className="property-status-dropdown-current">Current</span> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
