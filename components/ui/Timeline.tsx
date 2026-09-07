import { History } from "lucide-react";
import { EmptyState } from "@/components/ui/layout";
import { formatDateTime, formatRelative } from "@/lib/dates";

/**
 * The activity feed shown on record detail pages. Entries are written
 * automatically by the services, so the timeline is a byproduct of the work
 * rather than something anyone has to remember to fill in.
 */

export type TimelineEntry = {
  id: string;
  summary: string;
  createdAt: string;
  actorName: string | null;
  type: string;
};

/** Stage changes and publishing are the entries worth drawing attention to. */
const ACCENT_TYPES = new Set([
  "PROPERTY_PUBLISHED",
  "SALE_CREATED",
  "STAGE_CHANGED",
  "VIEWING_COMPLETED",
  "VERIFICATION_COMPLETED",
  "CLOSING_COMPLETED",
  "OWNERSHIP_CHANGED",
]);

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<History size={18} />}
        title="Nothing recorded yet"
        message="Calls, edits, publishing and every stage change will appear here automatically."
      />
    );
  }

  return (
    <ol className="timeline">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={
            ACCENT_TYPES.has(entry.type) ? "timeline-item timeline-item--accent" : "timeline-item"
          }
        >
          <div className="timeline-time">
            <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)}>
              {formatDateTime(entry.createdAt)}
            </time>
            <span className="subtle"> · {formatRelative(entry.createdAt)}</span>
          </div>
          <div className="timeline-summary">{entry.summary}</div>
        </li>
      ))}
    </ol>
  );
}
