"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save } from "lucide-react";
import { Card } from "@/components/ui/layout";
import { CommissionBreakdownView } from "@/components/ui/CommissionBreakdown";
import { useToast } from "@/components/ui/Toast";
import { formatGBP, formatRate } from "@/lib/money";
import { calculateCommission } from "@/services/commission-engine";
import {
  saveCommissionRuleAction,
  saveCrossSellSplitAction,
  saveExchangeRateAction,
} from "../actions";

/**
 * Commission configuration with a live worked example.
 *
 * The preview runs the real engine on the values being edited, so an
 * administrator sees exactly what a £1,000 deal would pay out before saving.
 */
export default function CommissionSettings({
  fronterRule,
  agentRule,
  split,
  rateX100,
}: {
  fronterRule: { type: "PERCENTAGE" | "FIXED"; value: number };
  agentRule: { type: "PERCENTAGE" | "FIXED"; value: number };
  split: { propertyAgentBp: number; tenantAgentBp: number };
  rateX100: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fronterType, setFronterType] = useState(fronterRule.type);
  const [fronterValue, setFronterValue] = useState(String(fronterRule.value / 100));
  const [agentType, setAgentType] = useState(agentRule.type);
  const [agentValue, setAgentValue] = useState(String(agentRule.value / 100));
  const [propertyShare, setPropertyShare] = useState(String(split.propertyAgentBp / 100));
  const [rate, setRate] = useState(String(rateX100 / 100));

  const tenantShare = Math.round((100 - Number(propertyShare || 0)) * 100) / 100;
  const splitValid = Number(propertyShare) >= 0 && Number(propertyShare) <= 100;

  // A representative deal, so the numbers on screen mean something.
  const preview = safePreview({
    fronter: { type: fronterType, value: Math.round(Number(fronterValue || 0) * 100) },
    agent: { type: agentType, value: Math.round(Number(agentValue || 0) * 100) },
    propertyAgentBp: Math.round(Number(propertyShare || 0) * 100),
    tenantAgentBp: Math.round(tenantShare * 100),
    rateX100: Math.round(Number(rate || 0) * 100),
  });

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="grid-sidebar">
      <div className="stack">
        {error && (
          <div className="alert alert--danger" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <Card title="Fronter commission">
          <p className="muted small" style={{ marginBottom: 12 }}>
            Taken from the gross company commission, before anything else. This is the default -
            an individual fronter can be given their own rate on their user record.
          </p>

          <RuleEditor
            type={fronterType}
            onTypeChange={setFronterType}
            value={fronterValue}
            onValueChange={setFronterValue}
          />

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    saveCommissionRuleAction({
                      scope: "FRONTER",
                      type: fronterType,
                      value: Math.round(Number(fronterValue || 0) * 100),
                    }),
                  "Fronter commission saved.",
                )
              }
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </Card>

        <Card title="Agent commission">
          <p className="muted small" style={{ marginBottom: 12 }}>
            Taken from what remains after the fronter. Whatever is left after this is the
            company&apos;s retained share.
          </p>

          <RuleEditor
            type={agentType}
            onTypeChange={setAgentType}
            value={agentValue}
            onValueChange={setAgentValue}
          />

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    saveCommissionRuleAction({
                      scope: "AGENT",
                      type: agentType,
                      value: Math.round(Number(agentValue || 0) * 100),
                    }),
                  "Agent commission saved.",
                )
              }
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </Card>

        <Card title="Cross-sell split">
          <p className="muted small" style={{ marginBottom: 12 }}>
            How the agent commission pool is divided when two agents share a deal. This applies to
            the agent pool only, never to the gross commission.
          </p>

          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="property-share">
                Property agent
              </label>
              <div className="input-group">
                <input
                  id="property-share"
                  className="input"
                  inputMode="decimal"
                  value={propertyShare}
                  onChange={(event) => setPropertyShare(event.target.value)}
                  aria-invalid={!splitValid}
                />
              </div>
              <span className="field-hint">Percent of the agent pool.</span>
            </div>

            <div className="field">
              <span className="field-label">Tenant agent</span>
              <div className="input" style={{ display: "flex", alignItems: "center" }}>
                {splitValid ? `${tenantShare}%` : "-"}
              </div>
              <span className="field-hint">Calculated so the two always total 100%.</span>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={pending || !splitValid}
              onClick={() =>
                run(
                  () =>
                    saveCrossSellSplitAction(
                      Math.round(Number(propertyShare) * 100),
                      Math.round(tenantShare * 100),
                    ),
                  "Cross-sell split saved.",
                )
              }
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </Card>

        <Card title="GBP to PKR rate">
          <p className="muted small" style={{ marginBottom: 12 }}>
            Used only to show an approximate PKR figure alongside commission. Never applied to
            rent, deposits or listing prices. Each sale keeps the rate that was live when it
            closed.
          </p>

          <div className="field" style={{ maxWidth: 220 }}>
            <label className="field-label" htmlFor="pkr-rate">
              PKR per GBP
            </label>
            <input
              id="pkr-rate"
              className="input numeric"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
            <span className="field-hint">{formatRate(Math.round(Number(rate || 0) * 100))}</span>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={pending || !Number(rate)}
              onClick={() =>
                run(() => saveExchangeRateAction(Number(rate)), "Exchange rate updated.")
              }
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </Card>
      </div>

      <div className="stack">
        <Card title="Worked example">
          <p className="muted small" style={{ marginBottom: 12 }}>
            A cross-sell deal with {formatGBP(100_000)} of gross company commission, using the
            values above.
          </p>

          {preview ? (
            <CommissionBreakdownView breakdown={preview} />
          ) : (
            <div className="alert alert--warning">
              <span>These values do not produce a valid split. Check the percentages.</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function RuleEditor({
  type,
  onTypeChange,
  value,
  onValueChange,
}: {
  type: "PERCENTAGE" | "FIXED";
  onTypeChange: (type: "PERCENTAGE" | "FIXED") => void;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="row">
      <div className="segmented" role="group" aria-label="Commission type">
        <button
          type="button"
          aria-pressed={type === "PERCENTAGE"}
          onClick={() => onTypeChange("PERCENTAGE")}
        >
          Percentage
        </button>
        <button type="button" aria-pressed={type === "FIXED"} onClick={() => onTypeChange("FIXED")}>
          Fixed amount
        </button>
      </div>

      <div className="input-group" style={{ maxWidth: 160 }}>
        {type === "FIXED" && (
          <span className="input-prefix" aria-hidden="true">
            £
          </span>
        )}
        <input
          className={type === "FIXED" ? "input input--with-prefix numeric" : "input numeric"}
          inputMode="decimal"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-label="Commission value"
        />
      </div>

      {type === "PERCENTAGE" && <span className="muted">%</span>}
    </div>
  );
}

/** The engine throws on an invalid split, which is the signal to show a warning. */
function safePreview(input: {
  fronter: { type: "PERCENTAGE" | "FIXED"; value: number };
  agent: { type: "PERCENTAGE" | "FIXED"; value: number };
  propertyAgentBp: number;
  tenantAgentBp: number;
  rateX100: number;
}) {
  try {
    return calculateCommission({
      grossCommissionPence: 100_000,
      fronterRule: input.fronter,
      agentRule: input.agent,
      crossSell: {
        propertyAgentBp: input.propertyAgentBp,
        tenantAgentBp: input.tenantAgentBp,
      },
      pkrRateX100: input.rateX100 || null,
    });
  } catch {
    return null;
  }
}
