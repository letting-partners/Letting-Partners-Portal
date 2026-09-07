"use client";

import { useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

/**
 * Form primitives. Every input is labelled, every error is tied to its field
 * with aria-describedby, and every submit button reflects pending state so a
 * user never wonders whether their click registered.
 */

export function Field({
  label,
  required,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="required" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  name,
  required,
  hint,
  error,
  type = "text",
  defaultValue,
  placeholder,
  autoComplete,
  inputMode,
  readOnly,
  maxLength,
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
  readOnly?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        name={name}
        type={type}
        className="input"
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        readOnly={readOnly}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  name,
  required,
  hint,
  error,
  defaultValue,
  placeholder,
  rows = 4,
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <textarea
        id={id}
        name={name}
        className="textarea"
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  options,
  required,
  hint,
  error,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  error?: string | null;
  defaultValue?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <select
        id={id}
        name={name}
        className="select"
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Yes / No segmented control. A hidden input carries the value so the control
 * works inside a plain form post as well as controlled React state.
 */
export function YesNoField({
  label,
  name,
  value,
  onChange,
  allowUnset = true,
}: {
  label: string;
  name: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  allowUnset?: boolean;
}) {
  return (
    <div className="row row--between" style={{ gap: 12 }}>
      <span style={{ fontSize: "0.85rem" }}>{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        <button
          type="button"
          data-tone="yes"
          aria-pressed={value === true}
          onClick={() => onChange(value === true && allowUnset ? null : true)}
        >
          Yes
        </button>
        <button
          type="button"
          data-tone="no"
          aria-pressed={value === false}
          onClick={() => onChange(value === false && allowUnset ? null : false)}
        >
          No
        </button>
      </div>
      <input type="hidden" name={name} value={value === null ? "" : String(value)} />
    </div>
  );
}

/** Submit button that disables and shows a spinner while the action runs. */
export function SubmitButton({
  children,
  variant = "primary",
  size,
  block,
  disabled,
  pendingLabel,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "lg";
  block?: boolean;
  disabled?: boolean;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const classes = [
    "btn",
    `btn--${variant}`,
    size ? `btn--${size}` : "",
    block ? "btn--block" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="submit" className={classes} disabled={pending || disabled}>
      {pending && <span className="spinner" aria-hidden="true" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert--danger" role="alert">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert--positive" role="status">
      <span>{message}</span>
    </div>
  );
}
