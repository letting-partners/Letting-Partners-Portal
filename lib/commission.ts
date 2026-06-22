import { GBP_TO_PKR } from "./format";

export type CommissionCurrency = "PKR" | "GBP" | "PCT";

export type FlexibleRange = {
  from: number;       // GBP lower bound (inclusive)
  to: number | null;  // GBP upper bound (exclusive); null = no upper limit
  amount: number;
  currency: CommissionCurrency;
};

export type CommissionConfigData = {
  type: "FIXED" | "FLEXIBLE";
  fixedAmount: number | null;
  fixedCurrency: CommissionCurrency | null;
  flexibleRanges: FlexibleRange[] | null;
};

/**
 * Calculate agent commission in GBP given the company's commission (in GBP).
 * The agent commission is always applied on the company commission amount,
 * not on the total sale amount.
 */
export function calcAgentCommissionGBP(
  companyCommissionGBP: number,
  config: CommissionConfigData
): number {
  if (config.type === "FIXED") {
    const amount = config.fixedAmount ?? 0;
    const currency = config.fixedCurrency ?? "PKR";
    if (currency === "PKR") return amount / GBP_TO_PKR;
    if (currency === "GBP") return amount;
    if (currency === "PCT") return (companyCommissionGBP * amount) / 100;
  } else {
    const ranges = config.flexibleRanges ?? [];
    for (const range of ranges) {
      const inRange =
        companyCommissionGBP >= range.from &&
        (range.to === null || companyCommissionGBP < range.to);
      if (inRange) {
        if (range.currency === "PKR") return range.amount / GBP_TO_PKR;
        if (range.currency === "GBP") return range.amount;
        if (range.currency === "PCT")
          return (companyCommissionGBP * range.amount) / 100;
      }
    }
  }
  return 0;
}

/** Describe the commission config in a short human-readable string. */
export function describeCommission(config: CommissionConfigData): string {
  if (config.type === "FIXED") {
    const amt = config.fixedAmount ?? 0;
    const cur = config.fixedCurrency ?? "PKR";
    if (cur === "PKR") return `PKR ${amt.toLocaleString("en-US")} per sale`;
    if (cur === "GBP") return `£${amt.toLocaleString("en-GB")} per sale`;
    if (cur === "PCT") return `${amt}% of company commission`;
  }
  return "Flexible (range-based)";
}
