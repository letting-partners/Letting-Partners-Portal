/**
 * Sales period filter helpers.
 * Uses native Date only (no external date library).
 */

export type PeriodKey =
  | "month"
  | "3d"
  | "week"
  | "last_month"
  | "year"
  | "all"
  | "custom";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: "This Month",
  "3d": "Last 3 Days",
  week: "Last Week",
  last_month: "Last Month",
  year: "Last Year",
  all: "All Time",
  custom: "Custom",
};

export const PERIOD_ORDER: PeriodKey[] = [
  "month",
  "3d",
  "week",
  "last_month",
  "year",
  "all",
  "custom",
];

export function isPeriodKey(value: string | undefined): value is PeriodKey {
  if (!value) return false;
  return PERIOD_ORDER.includes(value as PeriodKey);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function parseIsoDateOnly(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function parsePeriodToDateRange(
  period: string | undefined,
  from?: string,
  to?: string,
): { gte: Date; lte: Date } | undefined {
  const now = new Date();
  const key: PeriodKey = isPeriodKey(period) ? period : "month";

  switch (key) {
    case "month":
      return { gte: startOfMonth(now), lte: endOfMonth(now) };

    case "3d":
      return { gte: startOfDay(subDays(now, 2)), lte: endOfDay(now) };

    case "week":
      return { gte: startOfDay(subDays(now, 6)), lte: endOfDay(now) };

    case "last_month": {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { gte: startOfMonth(prev), lte: endOfMonth(prev) };
    }

    case "year":
      return { gte: startOfDay(subDays(now, 364)), lte: endOfDay(now) };

    case "all":
      return undefined;

    case "custom": {
      const fromDate = parseIsoDateOnly(from);
      const toDate = parseIsoDateOnly(to);
      if (!fromDate || !toDate || fromDate > toDate) {
        return { gte: startOfMonth(now), lte: endOfMonth(now) };
      }
      return { gte: startOfDay(fromDate), lte: endOfDay(toDate) };
    }
  }
}

export function formatPeriodRange(
  range: { gte: Date; lte: Date } | undefined,
): string {
  if (!range) return "All time";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(range.gte)} - ${fmt(range.lte)}`;
}

