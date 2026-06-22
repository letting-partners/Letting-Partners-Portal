"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
import { UIInput } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { apiGet, apiPatch } from "@/lib/api-client";

type PotentialLandlordDetail = {
  id: string;
  fullName: string;
  phone: string;
  phoneLast10: string;
  createdAt: string;
  updatedAt: string;
  addedByAgentId: string;
  canEdit: boolean;
  addedByAgent: {
    id: string;
    agentDisplayName: string;
    email: string;
  };
};

type Props = {
  landlordId: string;
  backHref: string;
  backLabel: string;
  adminMode?: boolean;
};

const LOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function PotentialLandlordDetailClient({
  landlordId,
  backHref,
  backLabel,
  adminMode = false,
}: Props) {
  const [landlord, setLandlord] = useState<PotentialLandlordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
  });

  async function load() {
    setLoading(true);
    const result = await apiGet<{ potentialLandlord: PotentialLandlordDetail }>(`/api/potential-landlords/${landlordId}`);
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load potential landlord." });
      return;
    }

    const row = result.data.potentialLandlord;
    setLandlord(row);
    setForm({
      fullName: row.fullName,
      phone: row.phone,
    });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!landlord?.canEdit) return;

    setSaving(true);
    setMessage(null);

    const result = await apiPatch<
      {
        fullName?: string;
        phone?: string;
      },
      {
      potentialLandlord: PotentialLandlordDetail;
      approvalRequired?: boolean;
      message?: string;
    }>(`/api/potential-landlords/${landlordId}`, {
      fullName: form.fullName.trim() || undefined,
      phone: form.phone.trim() || undefined,
    });

    setSaving(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update potential landlord." });
      return;
    }

    if (result.data.approvalRequired) {
      setMessage({
        type: "success",
        text: result.data.message ?? "Changes submitted for admin approval.",
      });
      return;
    }

    await load();
    setMessage({ type: "success", text: "Potential landlord updated successfully." });
  }

  const lockUntil = useMemo(() => {
    if (!landlord) return null;
    return new Date(new Date(landlord.createdAt).getTime() + LOCK_DURATION_MS);
  }, [landlord]);

  if (loading) {
    return <p className="muted">Loading potential landlord...</p>;
  }

  if (!landlord) {
    return (
      <div className="stack">
        {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : <UIAlert type="error">Potential landlord not found.</UIAlert>}
        <Link href={backHref} className="btn btn-secondary">
          {backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">{landlord.fullName}</h1>
          <p className="page-subtitle">Potential landlord prospect</p>
        </div>
        <div className="inline-row">
          <Link className="btn btn-secondary" href={backHref}>
            {backLabel}
          </Link>
        </div>
      </header>

      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <UICard>
        <UICardBody className="stack">
          <div className="inline-row">
            <span className="muted">Created {formatDateTime(landlord.createdAt)}</span>
            <span className="muted">Updated {formatDateTime(landlord.updatedAt)}</span>
            {lockUntil ? (
              <span className="muted">
                Lock until {lockUntil.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            ) : null}
          </div>

          <form className="field-grid" onSubmit={onSubmit}>
            <div className="form-section-divider">
              <span className="form-section-label">Prospect Details</span>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Full Name</span>
                <UIInput
                  value={form.fullName}
                  onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  disabled={!landlord.canEdit || saving}
                />
              </label>

              <label className="field">
                <span className="label">Phone</span>
                <UIInput
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  disabled={!landlord.canEdit || saving}
                />
              </label>
            </div>

            <div className="inline-row">
              {landlord.canEdit ? (
                <UIButton type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </UIButton>
              ) : (
                <span className="hint-text">Read-only for your account.</span>
              )}
            </div>
          </form>
        </UICardBody>
      </UICard>

      <UICard>
        <UICardBody className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Added By</span>
            {adminMode ? (
              <Link
                href={`/admin/agents/${landlord.addedByAgent.id}`}
                className="detail-value"
                style={{ color: "var(--brand-gold)", textDecoration: "none" }}
              >
                {landlord.addedByAgent.agentDisplayName}
              </Link>
            ) : (
              <span className="detail-value">{landlord.addedByAgent.agentDisplayName}</span>
            )}
          </div>
          <div className="detail-item">
            <span className="detail-label">Agent Email</span>
            <span className="detail-value">{landlord.addedByAgent.email}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Phone Last 10</span>
            <span className="detail-value">{landlord.phoneLast10}</span>
          </div>
        </UICardBody>
      </UICard>
    </div>
  );
}
