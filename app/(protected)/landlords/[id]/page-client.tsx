"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
import { UIInput } from "@/components/ui/input";
import { UISelect } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { fetchLandlordDetails, updateLandlord, type LandlordDetails, type SessionRole } from "@/lib/portal-api";

type Props = {
  landlordId: string;
  currentRole?: SessionRole;
};

export function LandlordDetailClient({ landlordId, currentRole }: Props) {
  const [landlord, setLandlord] = useState<LandlordDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    notes: "",
    isPassive: false,
  });

  const canEdit = useMemo(() => Boolean(landlord?.canEdit), [landlord?.canEdit]);

  async function load() {
    setLoading(true);
    setMessage(null);
    const result = await fetchLandlordDetails(landlordId);
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load landlord details." });
      return;
    }

    const row = result.data.landlord;
    setLandlord(row);
    setForm({
      fullName: row.landlordName,
      email: row.email ?? "",
      notes: row.notes ?? "",
      isPassive: row.isPassive ?? false,
    });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    // Validate passive change rules:
    // Agents can only set passive to true; admins can set either way
    if (currentRole === "AGENT" && form.isPassive === false && (landlord?.isPassive ?? false) === true) {
      setMessage({ type: "error", text: "Agents cannot reactivate a passive landlord. Contact admin." });
      return;
    }

    setSaving(true);
    const payload: Parameters<typeof updateLandlord>[1] = {
      fullName: form.fullName.trim(),
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };

    // Only include isPassive if it changed
    if (form.isPassive !== (landlord?.isPassive ?? false)) {
      payload.isPassive = form.isPassive;
    }

    const result = await updateLandlord(landlordId, payload);
    setSaving(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update landlord." });
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
    setMessage({ type: "success", text: "Landlord updated successfully." });
  }

  if (loading) return <p className="muted">Loading landlord...</p>;

  if (!landlord) {
    return (
      <div className="stack">
        {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : <UIAlert type="error">Landlord not found.</UIAlert>}
        <Link href="/landlords" className="btn btn-secondary">Back to Landlords</Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">{landlord.landlordName}</h1>
          <p className="page-subtitle">
            Phone: {landlord.phoneLast10} · Owner: {landlord.ownerAgent.agentDisplayName}
            {landlord.isPassive && <span className="badge badge-draft" style={{ marginLeft: "0.5rem" }}>Passive</span>}
          </p>
        </div>
        <div className="inline-row">
          <Link className="btn btn-secondary" href={`/landlords/${landlord.id}/properties`}>
            View Properties
          </Link>
          <Link className="btn btn-secondary" href="/landlords">
            Back
          </Link>
        </div>
      </header>

      <UICard>
        <UICardBody className="stack">
          <div className="inline-row">
            <span className="muted">Created {formatDateTime(landlord.createdAt)}</span>
            <span className="muted">Updated {formatDateTime(landlord.updatedAt)}</span>
            <span className="muted">{landlord._count?.properties ?? 0} properties</span>
          </div>

          {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

          <form className="field-grid" onSubmit={onSubmit}>
            <div className="form-section-divider">
              <span className="form-section-label">Landlord Details</span>
            </div>

            <label className="field">
              <span className="label">Phone Number</span>
              <UIInput value={landlord.phoneLast10} disabled />
              <span className="hint-text">Phone number cannot be changed after registration.</span>
            </label>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Full Name</span>
                <UIInput
                  value={form.fullName}
                  onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  disabled={!canEdit || saving}
                />
              </label>

              <label className="field">
                <span className="label">Email</span>
                <UIInput
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  disabled={!canEdit || saving}
                  placeholder="optional"
                />
              </label>
            </div>

            <label className="field">
              <span className="label">Notes</span>
              <UIInput
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                disabled={!canEdit || saving}
                placeholder="optional"
              />
            </label>

            <div className="form-section-divider">
              <span className="form-section-label">Status</span>
            </div>

            <label className="field">
              <span className="label">Landlord Status</span>
              <UISelect
                value={form.isPassive ? "passive" : "active"}
                onChange={(e) => setForm((prev) => ({ ...prev, isPassive: e.target.value === "passive" }))}
                disabled={!canEdit || saving || (currentRole === "AGENT" && !form.isPassive)}
              >
                <option value="active">Active</option>
                <option value="passive">Passive</option>
              </UISelect>
              <span className="hint-text">
                {currentRole === "AGENT"
                  ? "You can mark this landlord as passive. Only admin or a sale can reactivate them."
                  : "Admins can set active or passive. Auto-passive applies after 7 months with no sale."}
              </span>
            </label>

            <div className="inline-row">
              {canEdit ? (
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
    </div>
  );
}
