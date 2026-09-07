/**
 * Money is stored and calculated in whole pence, and percentages in basis
 * points (1000 bp = 10.00%). Nothing in this application may hold money in a
 * float. Every conversion and format goes through this file.
 */

export const BASIS_POINTS = 10_000;
export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

export function poundsToPence(pounds: number | string | null | undefined): number | null {
  if (pounds === null || pounds === undefined || pounds === "") return null;
  const value = typeof pounds === "string" ? Number(pounds.replace(/[^0-9.-]/g, "")) : pounds;
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function penceToPounds(pence: number | null | undefined): number | null {
  if (pence === null || pence === undefined) return null;
  return pence / 100;
}

/**
 * A monthly rent expressed as a weekly rent, using the correct annualised
 * conversion. Dividing by four would overstate the weekly figure.
 */
export function monthlyToWeeklyPence(monthlyPence: number): number {
  return Math.round((monthlyPence * MONTHS_PER_YEAR) / WEEKS_PER_YEAR);
}

export function weeklyToMonthlyPence(weeklyPence: number): number {
  return Math.round((weeklyPence * WEEKS_PER_YEAR) / MONTHS_PER_YEAR);
}

/** Percentage of an amount, in basis points, rounded to the nearest penny. */
export function applyBasisPoints(amountPence: number, basisPoints: number): number {
  return Math.round((amountPence * basisPoints) / BASIS_POINTS);
}

export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100;
}

const GBP_FORMATTER = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const GBP_FORMATTER_PRECISE = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Whole-pound display by default (rents and deposits are always round in
 * practice); pass `precise` for commission breakdowns where pennies matter.
 */
export function formatGBP(
  pence: number | null | undefined,
  options: { precise?: boolean; fallback?: string } = {},
): string {
  if (pence === null || pence === undefined) return options.fallback ?? "-";
  const pounds = pence / 100;
  const hasPennies = pence % 100 !== 0;
  const formatter = options.precise || hasPennies ? GBP_FORMATTER_PRECISE : GBP_FORMATTER;
  return formatter.format(pounds);
}

export function formatPercent(basisPoints: number | null | undefined): string {
  if (basisPoints === null || basisPoints === undefined) return "-";
  const percent = basisPointsToPercent(basisPoints);
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

/* --------------------------------------------------------------------- PKR */

const PKR_FORMATTER = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/**
 * Convert pence to whole PKR using a rate stored x100 (36900 = 369.00 PKR/GBP).
 * Only ever applied to commission figures, never to rent or deposits.
 */
export function penceToPkr(pence: number, rateX100: number): number {
  return Math.round((pence * rateX100) / 100 / 100);
}

export function formatPKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return `PKR ${PKR_FORMATTER.format(amount)}`;
}

/** "£350 (approx. PKR 129,150)" - always labelled approximate. */
export function formatGBPWithPkr(
  pence: number | null | undefined,
  rateX100: number | null | undefined,
): string {
  const gbp = formatGBP(pence, { precise: true });
  if (pence === null || pence === undefined || !rateX100) return gbp;
  return `${gbp} (approx. ${formatPKR(penceToPkr(pence, rateX100))})`;
}

export function formatRate(rateX100: number | null | undefined): string {
  if (!rateX100) return "-";
  return `1 GBP = ${(rateX100 / 100).toFixed(2)} PKR`;
}

/**
 * Split an amount across weighted shares without losing or inventing a penny.
 * The largest-remainder method: remainders are handed out one penny at a time,
 * biggest first, so the parts always sum exactly back to `totalPence`.
 */
export function splitPence(totalPence: number, weightsBp: number[]): number[] {
  const totalWeight = weightsBp.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return weightsBp.map(() => 0);

  const exact = weightsBp.map((w) => (totalPence * w) / totalWeight);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = totalPence - floors.reduce((sum, v) => sum + v, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...floors];
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    const target = order[cursor % order.length];
    result[target.index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return result;
}
