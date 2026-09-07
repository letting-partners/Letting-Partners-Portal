import type { ReactNode } from "react";

/**
 * One place that decides what colour a status is, so "Overdue" is the same
 * shade of danger everywhere it appears. Colours come from theme tokens - no
 * component ever hard-codes a hex value.
 */

export type BadgeTone = "neutral" | "positive" | "warning" | "danger" | "info" | "accent" | "strong";

const TONE_BY_STATUS: Record<string, BadgeTone> = {
  /* website listing lifecycle */
  DRAFT: "neutral",
  READY_TO_PUBLISH: "info",
  PUBLISHED: "positive",
  UNPUBLISHED: "neutral",
  LET_AGREED: "positive",
  INACTIVE: "neutral",
  ARCHIVED: "neutral",

  /* deal pipeline */
  AVAILABLE: "neutral",
  VIEWING: "info",
  VERIFICATION: "accent",
  CLOSING: "strong",
  CLOSED_SUCCESSFUL: "positive",
  CLOSED_UNSUCCESSFUL: "danger",

  /* rooms */
  LET: "positive",
  UNAVAILABLE: "neutral",

  /* follow ups */
  UPCOMING: "info",
  DUE_TODAY: "warning",
  OVERDUE: "danger",
  SCHEDULED: "info",
  COMPLETED: "positive",
  CONVERTED: "positive",
  CANCELLED: "neutral",

  /* calls */
  IN_PROGRESS: "info",
  INTERESTED: "positive",
  NOT_INTERESTED: "danger",
  FOLLOW_UP: "warning",
  NO_ANSWER: "neutral",

  /* viewings, verification, closing */
  COMPLETED_SUCCESSFUL: "positive",
  COMPLETED_UNSUCCESSFUL: "danger",
  SUCCESSFUL: "positive",
  UNSUCCESSFUL: "danger",
  CLOSED: "positive",
  NOT_CLOSED: "danger",

  /* tenants */
  ACTIVE: "positive",
  NEGOTIATING: "warning",
  PLACED: "positive",

  /* collaboration + chat */
  PENDING: "warning",
  ACCEPTED: "positive",
  DECLINED: "danger",
  NEW: "info",
  OPEN: "info",
  WAITING: "warning",
  RESOLVED: "positive",

  /* users */
  SUSPENDED: "danger",
  SUPER_ADMIN: "accent",
  AGENT: "info",
  FRONTER: "neutral",

  /* priority */
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "danger",
};

export function statusTone(status: string): BadgeTone {
  return TONE_BY_STATUS[status] ?? "neutral";
}

/** "CLOSED_SUCCESSFUL" -> "Closed successful" */
export function humanizeStatus(status: string): string {
  const lower = status.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function StatusBadge({
  status,
  label,
  dot = false,
}: {
  status: string;
  label?: string;
  dot?: boolean;
}) {
  const tone = statusTone(status);
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {label ?? humanizeStatus(status)}
    </span>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
