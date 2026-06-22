"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
import { UIInput } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { apiGet, apiPatch } from "@/lib/api-client";

type PotentialTenantDetail = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  interestedIn: string | null;
  budget: string | null;
  notes: string | null;
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
  tenantId: string;
  backHref: string;
  backLabel: string;
  adminMode?: boolean;
};

export function PotentialTenantDetailClient({
  tenantId,
  backHref,
  backLabel,
  adminMode = false,
}: Props) {
  const [tenant, setTenant] = useState<PotentialTenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    interestedIn: "",
    budget: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    const result = await apiGet<{ potentialTenant: PotentialTenantDetail }>(`/api/potential-tenants/${tenantId}`);
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load potential tenant." });
      return;
    }

    const row = result.data.potentialTenant;
    setTenant(row);
    setForm({
      fullName: row.fullName,
      email: row.email ?? "",
      phone: row.phone ?? "",
      interestedIn: row.interestedIn ?? "",
      budget: row.budget ?? "",
      notes: row.notes ?? "",
    });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant?.canEdit) return;

    setSaving(true);
    setMessage(null);

    const result = await apiPatch<
      {
        fullName?: string;
        email?: string | null;
        phone?: string | null;
        interestedIn?: string | null;
        budget?: string | null;
        notes?: string | null;
      },
      {
      potentialTenant: PotentialTenantDetail;
      approvalRequired?: boolean;
      message?: string;
    }>(`/api/potential-tenants/${tenantId}`, {
      fullName: form.fullName.trim() || undefined,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      interestedIn: form.interestedIn.trim() || null,
      budget: form.budget.trim() || null,
      notes: form.notes.trim() || null,
    });

    setSaving(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update potential tenant." });
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
    setMessage({ type: "success", text: "Potential tenant updated successfully." });
  }

  if (loading) {
    return <p className="muted">Loading potential tenant...</p>;
  }

  if (!tenant) {
    return (
      <div className="stack">
        {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : <UIAlert type="error">Potential tenant not found.</UIAlert>}
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
          <h1 className="page-title">{tenant.fullName}</h1>
          <p className="page-subtitle">{tenant.interestedIn ?? "Potential tenant record"}</p>
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
            <span className="muted">Created {formatDateTime(tenant.createdAt)}</span>
            <span className="muted">Updated {formatDateTime(tenant.updatedAt)}</span>
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
                  disabled={!tenant.canEdit || saving}
                />
              </label>

              <label className="field">
                <span className="label">Phone</span>
                <UIInput
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  disabled={!tenant.canEdit || saving}
                />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Email</span>
                <UIInput
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  disabled={!tenant.canEdit || saving}
                />
              </label>

              <label className="field">
                <span className="label">Interested In</span>
                <UIInput
                  value={form.interestedIn}
                  onChange={(event) => setForm((prev) => ({ ...prev, interestedIn: event.target.value }))}
                  disabled={!tenant.canEdit || saving}
                />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Budget</span>
                <UIInput
                  value={form.budget}
                  onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))}
                  disabled={!tenant.canEdit || saving}
                />
              </label>

              <label className="field">
                <span className="label">Notes</span>
                <UIInput
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  disabled={!tenant.canEdit || saving}
                />
              </label>
            </div>

            <div className="inline-row">
              {tenant.canEdit ? (
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
                href={`/admin/agents/${tenant.addedByAgent.id}`}
                className="detail-value"
                style={{ color: "var(--brand-gold)", textDecoration: "none" }}
              >
                {tenant.addedByAgent.agentDisplayName}
              </Link>
            ) : (
              <span className="detail-value">{tenant.addedByAgent.agentDisplayName}</span>
            )}
          </div>
          <div className="detail-item">
            <span className="detail-label">Agent Email</span>
            <span className="detail-value">{tenant.addedByAgent.email}</span>
          </div>
        </UICardBody>
      </UICard>
    </div>
  );
}
