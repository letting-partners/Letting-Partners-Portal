"use client";

import { useId } from "react";
import { formatGBP, monthlyToWeeklyPence, poundsToPence, weeklyToMonthlyPence } from "@/lib/money";

/**
 * Money is entered in pounds and held in pence. The component owns the
 * conversion so no caller ever has to remember which unit it is holding.
 */

export function MoneyInput({
  label,
  value,
  onChange,
  required,
  hint,
  error,
  placeholder = "0",
}: {
  label: string;
  /** Pence, or null when empty. */
  value: number | null;
  onChange: (pence: number | null) => void;
  required?: boolean;
  hint?: string;
  error?: string | null;
  placeholder?: string;
}) {
  const id = useId();
  const displayValue = value === null ? "" : String(value / 100);

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required && (
          <span className="required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="input-group">
        <span className="input-prefix" aria-hidden="true">
          £
        </span>
        <input
          id={id}
          className="input input--with-prefix"
          inputMode="decimal"
          value={displayValue}
          placeholder={placeholder}
          required={required}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const raw = event.target.value.trim();
            onChange(raw === "" ? null : poundsToPence(raw));
          }}
        />
      </div>
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Rent entry with a live equivalent underneath, so the user always sees both
 * figures. The conversion is annualised (x12/52), never a divide by four.
 */
export function RentInput({
  label,
  frequency,
  onFrequencyChange,
  value,
  onChange,
  required,
}: {
  label: string;
  frequency: "MONTHLY" | "WEEKLY";
  onFrequencyChange?: (frequency: "MONTHLY" | "WEEKLY") => void;
  value: number | null;
  onChange: (pence: number | null) => void;
  required?: boolean;
}) {
  const equivalent =
    value === null
      ? null
      : frequency === "MONTHLY"
        ? monthlyToWeeklyPence(value)
        : weeklyToMonthlyPence(value);

  return (
    <div className="stack--sm stack">
      <MoneyInput
        label={label}
        value={value}
        onChange={onChange}
        required={required}
        hint={
          equivalent === null
            ? undefined
            : frequency === "MONTHLY"
              ? `Equivalent to ${formatGBP(equivalent)} per week`
              : `Equivalent to ${formatGBP(equivalent)} per month`
        }
      />

      {onFrequencyChange && (
        <div className="segmented" role="group" aria-label="Rent frequency">
          <button
            type="button"
            aria-pressed={frequency === "MONTHLY"}
            onClick={() => onFrequencyChange("MONTHLY")}
          >
            Per month
          </button>
          <button
            type="button"
            aria-pressed={frequency === "WEEKLY"}
            onClick={() => onFrequencyChange("WEEKLY")}
          >
            Per week
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Commission agreed with the landlord: either a percentage of one month of
 * rent, or a fixed amount. Both are stored, so the basis is never ambiguous.
 */
export function CommissionInput({
  type,
  onTypeChange,
  value,
  onValueChange,
  monthlyRentPence,
  label = "Commission agreed",
  required,
}: {
  type: "PERCENTAGE" | "FIXED";
  onTypeChange: (type: "PERCENTAGE" | "FIXED") => void;
  /** Basis points when PERCENTAGE, pence when FIXED. */
  value: number | null;
  onValueChange: (value: number | null) => void;
  monthlyRentPence: number | null;
  label?: string;
  required?: boolean;
}) {
  const id = useId();

  const resolved =
    type === "FIXED"
      ? value
      : value !== null && monthlyRentPence
        ? Math.round((monthlyRentPence * value) / 10_000)
        : null;

  return (
    <div className="stack--sm stack">
      <div className="field">
        <label className="field-label" htmlFor={id}>
          {label}
          {required && (
            <span className="required" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <div className="row" style={{ alignItems: "stretch" }}>
          <div className="segmented" role="group" aria-label="Commission type">
            <button
              type="button"
              aria-pressed={type === "PERCENTAGE"}
              onClick={() => {
                onTypeChange("PERCENTAGE");
                onValueChange(null);
              }}
            >
              %
            </button>
            <button
              type="button"
              aria-pressed={type === "FIXED"}
              onClick={() => {
                onTypeChange("FIXED");
                onValueChange(null);
              }}
            >
              £
            </button>
          </div>

          <div className="input-group" style={{ flex: 1 }}>
            {type === "FIXED" && (
              <span className="input-prefix" aria-hidden="true">
                £
              </span>
            )}
            <input
              id={id}
              className={type === "FIXED" ? "input input--with-prefix" : "input"}
              inputMode="decimal"
              required={required}
              value={
                value === null
                  ? ""
                  : type === "PERCENTAGE"
                    ? String(value / 100)
                    : String(value / 100)
              }
              placeholder={type === "PERCENTAGE" ? "100" : "0"}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (raw === "") {
                  onValueChange(null);
                  return;
                }
                const numeric = Number(raw.replace(/[^0-9.]/g, ""));
                if (!Number.isFinite(numeric)) return;
                // Percentages are basis points, fixed amounts are pence.
                onValueChange(Math.round(numeric * 100));
              }}
            />
          </div>
        </div>

        <span className="field-hint">
          {type === "PERCENTAGE"
            ? resolved !== null
              ? `${(value ?? 0) / 100}% of one month of rent = ${formatGBP(resolved)}`
              : "Percentage of one month of rent."
            : "A fixed fee agreed with the landlord."}
        </span>
      </div>
    </div>
  );
}
