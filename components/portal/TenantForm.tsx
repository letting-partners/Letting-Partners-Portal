"use client";

import { FormEvent, useEffect, useState } from "react";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { UISelect } from "@/components/ui/select";
import { normalizePhoneNo, normalizePostcode } from "@/lib/normalize";
import { UppercasePostcodeInput } from "@/components/portal/UppercasePostcodeInput";

export type TenantFormValues = {
  fullName: string;
  email: string;
  phoneNo: string;
  currentAddress: string;
  currentPostcode: string;
  preferredPostcode: string;
  interestedIn: string;
  budget: string;
  moveInDate: string;
  rentAmount: string;
  depositAmount: string;
  notes: string;
};

type Props = {
  title?: string;
  description?: string;
  submitLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  initialValue?: Partial<TenantFormValues>;
  onSubmit: (values: TenantFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

const DEFAULT_VALUES: TenantFormValues = {
  fullName: "",
  email: "",
  phoneNo: "",
  currentAddress: "",
  currentPostcode: "",
  preferredPostcode: "",
  interestedIn: "",
  budget: "",
  moveInDate: "",
  rentAmount: "",
  depositAmount: "",
  notes: "",
};

export function TenantForm({
  title = "Tenant Details",
  description,
  submitLabel = "Save Tenant",
  busy = false,
  disabled = false,
  initialValue,
  onSubmit,
  onCancel,
}: Props) {
  const [value, setValue] = useState<TenantFormValues>(DEFAULT_VALUES);

  useEffect(() => {
    setValue({
      fullName: initialValue?.fullName ?? "",
      email: initialValue?.email ?? "",
      phoneNo: initialValue?.phoneNo ?? "",
      currentAddress: initialValue?.currentAddress ?? "",
      currentPostcode: normalizePostcode(initialValue?.currentPostcode ?? ""),
      preferredPostcode: normalizePostcode(initialValue?.preferredPostcode ?? ""),
      interestedIn: initialValue?.interestedIn ?? "",
      budget: initialValue?.budget ?? "",
      moveInDate: initialValue?.moveInDate ?? "",
      rentAmount: initialValue?.rentAmount ?? "",
      depositAmount: initialValue?.depositAmount ?? "",
      notes: initialValue?.notes ?? "",
    });
  }, [
    initialValue?.fullName,
    initialValue?.email,
    initialValue?.phoneNo,
    initialValue?.currentAddress,
    initialValue?.currentPostcode,
    initialValue?.preferredPostcode,
    initialValue?.interestedIn,
    initialValue?.budget,
    initialValue?.moveInDate,
    initialValue?.rentAmount,
    initialValue?.depositAmount,
    initialValue?.notes,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      fullName: value.fullName.trim(),
      email: value.email.trim(),
      phoneNo: normalizePhoneNo(value.phoneNo),
      currentAddress: value.currentAddress.trim(),
      currentPostcode: normalizePostcode(value.currentPostcode),
      preferredPostcode: normalizePostcode(value.preferredPostcode),
      interestedIn: value.interestedIn.trim(),
      budget: value.budget.trim(),
      moveInDate: value.moveInDate,
      rentAmount: value.rentAmount.trim(),
      depositAmount: value.depositAmount.trim(),
      notes: value.notes.trim(),
    });
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="stack" style={{ gap: "0.35rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>{title}</h2>
        {description ? <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.84rem" }}>{description}</p> : null}
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Full Name <span style={{ color: "var(--danger)" }}>*</span></span>
          <UIInput
            value={value.fullName}
            onChange={(event) => setValue((current) => ({ ...current, fullName: event.target.value }))}
            disabled={busy || disabled}
            placeholder="Jane Doe"
            required
          />
        </label>

        <label className="field">
          <span className="label">Phone No <span style={{ color: "var(--danger)" }}>*</span></span>
          <UIInput
            value={value.phoneNo}
            onChange={(event) => setValue((current) => ({ ...current, phoneNo: event.target.value }))}
            disabled={busy || disabled}
            placeholder="07911 122233"
            required
          />
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Email (optional)</span>
          <UIInput
            type="email"
            value={value.email}
            onChange={(event) => setValue((current) => ({ ...current, email: event.target.value }))}
            disabled={busy || disabled}
            placeholder="tenant@example.com"
          />
        </label>

        <label className="field">
          <span className="label">Move-In Date</span>
          <UIInput
            type="date"
            value={value.moveInDate}
            onChange={(event) => setValue((current) => ({ ...current, moveInDate: event.target.value }))}
            disabled={busy || disabled}
          />
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Current Address</span>
          <UIInput
            value={value.currentAddress}
            onChange={(event) => setValue((current) => ({ ...current, currentAddress: event.target.value }))}
            disabled={busy || disabled}
            placeholder="123 Old Road"
          />
        </label>

        <label className="field">
          <span className="label">Current Postcode</span>
          <UppercasePostcodeInput
            value={value.currentPostcode}
            onChange={(nextValue) => setValue((current) => ({ ...current, currentPostcode: nextValue }))}
            disabled={busy || disabled}
            placeholder="SW1A 1AA"
          />
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Preferred Postcode</span>
          <UppercasePostcodeInput
            value={value.preferredPostcode}
            onChange={(nextValue) => setValue((current) => ({ ...current, preferredPostcode: nextValue }))}
            disabled={busy || disabled}
            placeholder="NW1 6XE"
          />
        </label>

        <label className="field">
          <span className="label">Interest</span>
          <UIInput
            value={value.interestedIn}
            onChange={(event) => setValue((current) => ({ ...current, interestedIn: event.target.value }))}
            disabled={busy || disabled}
            placeholder="2-bed flat, family home..."
          />
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Budget</span>
          <UIInput
            value={value.budget}
            onChange={(event) => setValue((current) => ({ ...current, budget: event.target.value }))}
            disabled={busy || disabled}
            placeholder="e.g. £1,100 pcm"
          />
        </label>

        <label className="field">
          <span className="label">Rent Amount</span>
          <UIInput
            type="number"
            min={0}
            step="0.01"
            value={value.rentAmount}
            onChange={(event) => setValue((current) => ({ ...current, rentAmount: event.target.value }))}
            disabled={busy || disabled}
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Deposit Amount</span>
          <UIInput
            type="number"
            min={0}
            step="0.01"
            value={value.depositAmount}
            onChange={(event) => setValue((current) => ({ ...current, depositAmount: event.target.value }))}
            disabled={busy || disabled}
            placeholder="Optional"
          />
        </label>

        <div className="field">
          <span className="label">Communication Preference</span>
          <UISelect disabled={busy || disabled} defaultValue="phone">
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </UISelect>
        </div>
      </div>

      <label className="field">
        <span className="label">Notes</span>
        <textarea
          className="textarea"
          value={value.notes}
          onChange={(event) => setValue((current) => ({ ...current, notes: event.target.value }))}
          disabled={busy || disabled}
          rows={4}
          placeholder="Any extra notes about the tenant or viewing."
        />
      </label>

      <div className="inline-row" style={{ marginTop: "0.25rem" }}>
        <UIButton type="submit" disabled={busy || disabled}>
          {busy ? "Saving..." : submitLabel}
        </UIButton>
        {onCancel ? (
          <UIButton type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </UIButton>
        ) : null}
      </div>
    </form>
  );
}