/**
 * Timestamps are stored in UTC and rendered in the business timezone.
 * UK date formatting ("06 Sep 2026") is used consistently across the portal.
 */

export const BUSINESS_TIMEZONE = "Europe/London";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: BUSINESS_TIMEZONE,
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: BUSINESS_TIMEZONE,
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: BUSINESS_TIMEZONE,
});

const LONG_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BUSINESS_TIMEZONE,
});

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: Date | string | null | undefined, fallback = "-"): string {
  const date = toDate(value);
  return date ? DATE_FORMAT.format(date) : fallback;
}

export function formatLongDate(value: Date | string | null | undefined, fallback = "-"): string {
  const date = toDate(value);
  return date ? LONG_DATE_FORMAT.format(date) : fallback;
}

export function formatDateTime(value: Date | string | null | undefined, fallback = "-"): string {
  const date = toDate(value);
  return date ? DATE_TIME_FORMAT.format(date) : fallback;
}

export function formatTime(value: Date | string | null | undefined, fallback = "-"): string {
  const date = toDate(value);
  return date ? TIME_FORMAT.format(date) : fallback;
}

/** "just now", "12 min ago", "3 h ago", then falls back to a date. */
export function formatRelative(value: Date | string | null | undefined, fallback = "-"): string {
  const date = toDate(value);
  if (!date) return fallback;

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1 && diffMinutes > -1) return "just now";
  if (diffMinutes > 0 && diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 0 && diffMinutes > -60) return `in ${Math.abs(diffMinutes)} min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours > 0 && diffHours < 24) return `${diffHours} h ago`;
  if (diffHours < 0 && diffHours > -24) return `in ${Math.abs(diffHours)} h`;

  return formatDate(date);
}

/** The `date` column type comes back as "YYYY-MM-DD"; keep it timezone-free. */
export function formatDateOnly(value: string | null | undefined, fallback = "-"): string {
  if (!value) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return fallback;
  return formatDate(new Date(Date.UTC(year, month - 1, day)));
}

export function toDateOnlyString(value: Date | string | null | undefined): string | null {
  const date = toDate(value);
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

/* --------------------------------------------------------------- ranges */

export type DateRangePreset = "today" | "yesterday" | "week" | "month" | "all";

export type DateRange = { from: Date; to: Date };

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function resolveDateRange(preset: DateRangePreset, now = new Date()): DateRange | null {
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case "week": {
      const start = new Date(now);
      // Monday-based week, as the business reports Monday to Sunday.
      const weekday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - weekday);
      return { from: startOfDay(start), to: endOfDay(now) };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(start), to: endOfDay(now) };
    }
    case "all":
    default:
      return null;
  }
}

export { startOfDay, endOfDay };

/* ------------------------------------------------------------ follow ups */

export type FollowUpTimeState = "UPCOMING" | "DUE_TODAY" | "OVERDUE";

/**
 * Derived, never stored: a scheduled follow-up is overdue, due today or
 * upcoming purely as a function of the clock.
 */
export function followUpTimeState(dueAt: Date | string, now = new Date()): FollowUpTimeState {
  const due = toDate(dueAt);
  if (!due) return "UPCOMING";
  if (due.getTime() < now.getTime()) return "OVERDUE";
  if (startOfDay(due).getTime() === startOfDay(now).getTime()) return "DUE_TODAY";
  return "UPCOMING";
}
