"use client";

import { FormEvent, useEffect, useState } from "react";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { normalizePhoneNo } from "@/lib/normalize";

export type LandlordFormValues = {
  firstName: string;
  lastName: string;
  phoneNo: string;
  email: string;
};

type Props = {
  initialValue?: Partial<LandlordFormValues>;
  title?: string;
  description?: string;
  submitLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: (values: LandlordFormValues) => void | Promise<void>;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
};

const EMPTY_VALUE: LandlordFormValues = {
  firstName: "",
  lastName: "",
  phoneNo: "",
  email: "",
};

export function LandlordForm({
  initialValue,
  title = "Landlord Details",
  description,
  submitLabel = "Continue",
  busy = false,
  disabled = false,
  onSubmit,
  secondaryAction,
}: Props) {
  const [value, setValue] = useState<LandlordFormValues>(EMPTY_VALUE);

  useEffect(() => {
    setValue({
      firstName: initialValue?.firstName ?? "",
      lastName: initialValue?.lastName ?? "",
      phoneNo: initialValue?.phoneNo ?? "",
      email: initialValue?.email ?? "",
    });
  }, [initialValue?.firstName, initialValue?.lastName, initialValue?.phoneNo, initialValue?.email]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      phoneNo: normalizePhoneNo(value.phoneNo),
      email: value.email.trim(),
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
          <span className="label">First Name <span style={{ color: "var(--danger)" }}>*</span></span>
          <UIInput
            value={value.firstName}
            onChange={(event) => setValue((current) => ({ ...current, firstName: event.target.value }))}
            disabled={busy || disabled}
            placeholder="Ahmed"
            required
          />
        </label>

        <label className="field">
          <span className="label">Last Name <span style={{ color: "var(--danger)" }}>*</span></span>
          <UIInput
            value={value.lastName}
            onChange={(event) => setValue((current) => ({ ...current, lastName: event.target.value }))}
            disabled={busy || disabled}
            placeholder="Khan"
            required
          />
        </label>
      </div>

      <div className="field-grid-2">
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

        <label className="field">
          <span className="label">Email (optional)</span>
          <UIInput
            type="email"
            value={value.email}
            onChange={(event) => setValue((current) => ({ ...current, email: event.target.value }))}
            disabled={busy || disabled}
            placeholder="owner@example.com"
          />
        </label>
      </div>

      <div className="inline-row" style={{ marginTop: "0.25rem" }}>
        <UIButton type="submit" disabled={busy || disabled}>
          {busy ? "Saving..." : submitLabel}
        </UIButton>
        {secondaryAction ? (
          <UIButton type="button" variant="secondary" onClick={secondaryAction.onClick} disabled={busy}>
            {secondaryAction.label}
          </UIButton>
        ) : null}
      </div>
    </form>
  );
}