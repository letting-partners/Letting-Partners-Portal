"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
import { UIInput } from "@/components/ui/input";
import { createLandlord, checkLandlordNumber } from "@/lib/portal-api";

export default function AddLandlordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneChecked, setPhoneChecked] = useState(false);
  const [phoneConflict, setPhoneConflict] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const canSubmit = useMemo(
    () => phoneChecked && !phoneConflict && phone.trim().length > 0 && name.trim().length > 0,
    [phoneChecked, phoneConflict, phone, name],
  );

  async function checkPhone() {
    const trimmed = phone.trim();
    if (!trimmed) return;
    setChecking(true);
    setMessage(null);
    setPhoneConflict(null);
    setPhoneChecked(false);
    const result = await checkLandlordNumber(trimmed);
    setChecking(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Invalid phone number." });
      return;
    }

    if (result.data.landlordExists) {
      const conflict = result.data.landlord;
      setPhoneConflict(
        `A landlord with this number already exists: ${conflict?.landlordName} (${conflict?.ownerAgent?.agentDisplayName ?? "another agent"}).`,
      );
      return;
    }

    setPhoneChecked(true);
    setMessage({ type: "success", text: "Phone number is available. Fill in details below." });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setMessage(null);

    const result = await createLandlord({
      fullName: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSaving(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to create landlord." });
      return;
    }

    router.push("/landlords");
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Add New Landlord</h1>
          <p className="page-subtitle">Register a new landlord. Phone number must be a valid UK number.</p>
        </div>
        <UIButton variant="secondary" onClick={() => router.push("/landlords")}>
          Back to Landlords
        </UIButton>
      </header>

      <UICard>
        <UICardBody>
          <form className="field-grid" onSubmit={handleSubmit}>
            <label className="field">
              <span className="label">
                Phone Number <span style={{ color: "var(--danger)" }}>*</span>
              </span>
              <div className="inline-row">
                <UIInput
                  style={{ flex: 1 }}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneChecked(false);
                    setPhoneConflict(null);
                    setMessage(null);
                  }}
                  onBlur={() => void checkPhone()}
                  placeholder="+44 7911 122 233 or 07911122233"
                  disabled={saving}
                />
                <UIButton
                  type="button"
                  variant="secondary"
                  onClick={() => void checkPhone()}
                  disabled={checking || saving || !phone.trim()}
                >
                  {checking ? "Checking..." : "Check"}
                </UIButton>
              </div>
              <span className="hint-text">UK mobile or landline. We verify it&apos;s not already registered.</span>
            </label>

            {phoneConflict && (
              <UIAlert type="error">{phoneConflict}</UIAlert>
            )}

            {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

            {phoneChecked && !phoneConflict && (
              <>
                <div className="form-section-divider">
                  <span className="form-section-label">Landlord Details</span>
                </div>

                <div className="field-grid-2">
                  <label className="field">
                    <span className="label">
                      Full Name <span style={{ color: "var(--danger)" }}>*</span>
                    </span>
                    <UIInput
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Smith"
                      disabled={saving}
                    />
                  </label>
                  <label className="field">
                    <span className="label">Email (optional)</span>
                    <UIInput
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      disabled={saving}
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="label">Notes (optional)</span>
                  <UIInput
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about this landlord..."
                    disabled={saving}
                  />
                </label>
              </>
            )}

            <div className="inline-row" style={{ marginTop: "0.5rem" }}>
              <UIButton type="submit" disabled={!canSubmit || saving}>
                {saving ? "Creating..." : "Create Landlord"}
              </UIButton>
              <UIButton type="button" variant="secondary" onClick={() => router.push("/landlords")} disabled={saving}>
                Cancel
              </UIButton>
            </div>
          </form>
        </UICardBody>
      </UICard>
    </div>
  );
}
