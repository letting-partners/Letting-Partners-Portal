// ── Exchange rate (update when needed) ─────────────────────────────────────
// 1 GBP = GBP_TO_PKR PKR
export const GBP_TO_PKR = 365;

// Fixed agent commission per closed sale (in PKR)
export const AGENT_COMMISSION_PKR = 5_000;

/** Format a PKR amount — e.g. "PKR 5,000" */
export function formatPKR(pkr: number): string {
  return "PKR " + new Intl.NumberFormat("en-US").format(Math.round(pkr));
}

/** Convert GBP → PKR using fixed rate */
export function gbpToPkr(gbp: number): number {
  return gbp * GBP_TO_PKR;
}

/** Convert PKR → GBP using fixed rate */
export function pkrToGbp(pkr: number): number {
  return pkr / GBP_TO_PKR;
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      notation: "compact",
    }).format(value);
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
