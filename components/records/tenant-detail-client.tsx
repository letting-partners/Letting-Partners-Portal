"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
import { UIInput } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { apiGet } from "@/lib/api-client";
import { updateTenant } from "@/lib/portal-api";

type TenantDetail = {
  id: string;
  saleId: string | null;
  addedByAgentId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  phoneLast10: string | null;
  currentAddress: string | null;
  moveInDate: string | null;
  rentAmount: string | null;
  depositAmount: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  addedByAgent: {
    id: string;
    agentDisplayName: string;
    email: string;
  } | null;
  sale: {
    id: string;
    finalAmount: string;
    commissionAmount: string;
    closedAt: string;
    property: {
      id: string;
      propertyRef: string;
      addressLine1: string | null;
      city: string | null;
      postcode: string | null;
      ownerAgentId: string;
      ownerAgent: {
        id: string;
        agentDisplayName: string;
        email: string;
      };
      landlord: {
        id: string;
        landlordName: string;
      };
    };
  } | null;
};

type Props = {
  tenantId: string;
  backHref: string;
  backLabel: string;
  adminMode?: boolean;
};

export function TenantDetailClient({
  tenantId,
  backHref,
  backLabel,
  adminMode = false,
}: Props) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    currentAddress: "",
    moveInDate: "",
    rentAmount: "",
    depositAmount: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    const result = await apiGet<{ tenant: TenantDetail }>(`/api/tenants/${tenantId}`);
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load tenant details." });
      return;
    }

    const row = result.data.tenant;
    setTenant(row);
    setForm({
      fullName: row.fullName,
      email: row.email ?? "",
      currentAddress: row.currentAddress ?? "",
      moveInDate: row.moveInDate ? new Date(row.moveInDate).toISOString().slice(0, 10) : "",
      rentAmount: row.rentAmount ?? "",
      depositAmount: row.depositAmount ?? "",
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

    const result = await updateTenant(tenantId, {
      fullName: form.fullName.trim() || undefined,
      email: form.email.trim() || null,
      currentAddress: form.currentAddress.trim() || null,
      moveInDate: form.moveInDate ? new Date(form.moveInDate).toISOString() : null,
      rentAmount: form.rentAmount.trim() ? Number(form.rentAmount) : null,
      depositAmount: form.depositAmount.trim() ? Number(form.depositAmount) : null,
      notes: form.notes.trim() || null,
    });

    setSaving(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update tenant." });
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
    setMessage({ type: "success", text: "Tenant updated successfully." });
  }

  if (loading) {
    return <p className="muted">Loading tenant...</p>;
  }

  if (!tenant) {
    return (
      <div className="stack">
        {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : <UIAlert type="error">Tenant not found.</UIAlert>}
        <Link href={backHref} className="btn btn-secondary">
          {backLabel}
        </Link>
      </div>
    );
  }

  const propertyHref = tenant.sale?.property
    ? adminMode
      ? `/admin/properties/${tenant.sale.property.id}`
      : `/portal/properties/${tenant.sale.property.id}`
    : null;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">{tenant.fullName}</h1>
          <p className="page-subtitle">
            {tenant.phone ?? tenant.phoneLast10 ?? "No phone"}
            {tenant.sale?.property ? ` · ${tenant.sale.property.addressLine1 ?? tenant.sale.property.propertyRef}` : ""}
          </p>
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
              <span className="form-section-label">Tenant Details</span>
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
                <span className="label">Phone Number</span>
                <UIInput value={tenant.phone ?? tenant.phoneLast10 ?? ""} disabled />
                <span className="hint-text">Phone is read-only after tenant creation.</span>
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
                <span className="label">Current Address</span>
                <UIInput
                  value={form.currentAddress}
                  onChange={(event) => setForm((prev) => ({ ...prev, currentAddress: event.target.value }))}
                  disabled={!tenant.canEdit || saving}
                />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Move-In Date</span>
                <UIInput
                  type="date"
                  value={form.moveInDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, moveInDate: event.target.value }))}
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

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Rent Amount</span>
                <UIInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.rentAmount}
                  onChange={(event) => setForm((prev) => ({ ...prev, rentAmount: event.target.value }))}
                  disabled={!tenant.canEdit || saving}
                />
              </label>

              <label className="field">
                <span className="label">Deposit Amount</span>
                <UIInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.depositAmount}
                  onChange={(event) => setForm((prev) => ({ ...prev, depositAmount: event.target.value }))}
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
        <UICardBody className="stack">
          <div className="form-section-divider">
            <span className="form-section-label">Linked Records</span>
          </div>

          {tenant.sale?.property ? (
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Property</span>
                {propertyHref ? (
                  <Link href={propertyHref} className="detail-value" style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                    {tenant.sale.property.addressLine1 ?? tenant.sale.property.propertyRef}
                  </Link>
                ) : (
                  <span className="detail-value">{tenant.sale.property.addressLine1 ?? tenant.sale.property.propertyRef}</span>
                )}
              </div>
              <div className="detail-item">
                <span className="detail-label">Postcode</span>
                <span className="detail-value">{tenant.sale.property.postcode ?? "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Landlord</span>
                <Link
                  href={`/landlords/${tenant.sale.property.landlord.id}`}
                  className="detail-value"
                  style={{ color: "var(--brand-gold)", textDecoration: "none" }}
                >
                  {tenant.sale.property.landlord.landlordName}
                </Link>
              </div>
              <div className="detail-item">
                <span className="detail-label">Agent</span>
                {adminMode ? (
                  <Link
                    href={`/admin/agents/${tenant.sale.property.ownerAgent.id}`}
                    className="detail-value"
                    style={{ color: "var(--brand-gold)", textDecoration: "none" }}
                  >
                    {tenant.sale.property.ownerAgent.agentDisplayName}
                  </Link>
                ) : (
                  <span className="detail-value">{tenant.sale.property.ownerAgent.agentDisplayName}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Added By</span>
                <span className="detail-value">{tenant.addedByAgent?.agentDisplayName ?? "-"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Source</span>
                <span className="detail-value">Standalone tenant record</span>
              </div>
            </div>
          )}
        </UICardBody>
      </UICard>
    </div>
  );
}
