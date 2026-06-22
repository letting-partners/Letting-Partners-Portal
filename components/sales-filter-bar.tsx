"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { PERIOD_LABELS, PERIOD_ORDER, type PeriodKey } from "@/lib/period";

type Props = {
  period: PeriodKey;
  from?: string;
  to?: string;
  rangeLabel: string;
  salesCount?: number;
};

export function SalesFilterBar({ period, from, to, rangeLabel, salesCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");

  useEffect(() => {
    setCustomFrom(from ?? "");
    setCustomTo(to ?? "");
  }, [from, to]);

  const subtitle =
    salesCount === undefined
      ? `Range: ${rangeLabel}`
      : `${salesCount} closed sale${salesCount === 1 ? "" : "s"} - ${rangeLabel}`;

  function pushWithParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function onPresetClick(nextPeriod: PeriodKey) {
    pushWithParams((params) => {
      params.set("period", nextPeriod);
      if (nextPeriod !== "custom") {
        params.delete("from");
        params.delete("to");
      }
    });
  }

  function applyCustomRange() {
    pushWithParams((params) => {
      params.set("period", "custom");
      if (customFrom) params.set("from", customFrom);
      else params.delete("from");
      if (customTo) params.set("to", customTo);
      else params.delete("to");
    });
  }

  return (
    <div className="sales-filter-bar">
      <div className="sales-filter-top">
        <p className="sales-filter-title">Sales Period</p>
        <p className="sales-filter-subtitle">{subtitle}</p>
      </div>

      <div className="sales-filter-presets">
        {PERIOD_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`sales-filter-pill${period === key ? " is-active" : ""}`}
            onClick={() => onPresetClick(key)}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="sales-filter-custom">
          <label className="field">
            <span className="label">From</span>
            <UIInput type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">To</span>
            <UIInput type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </label>
          <div className="sales-filter-custom-actions">
            <UIButton
              type="button"
              onClick={applyCustomRange}
              disabled={!customFrom || !customTo}
            >
              Apply
            </UIButton>
            <UIButton
              type="button"
              variant="secondary"
              onClick={() => onPresetClick("month")}
            >
              Reset
            </UIButton>
          </div>
        </div>
      )}
    </div>
  );
}

