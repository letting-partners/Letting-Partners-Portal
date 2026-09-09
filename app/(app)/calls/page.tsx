import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDateTime } from "@/lib/dates";
import { displayPhone } from "@/lib/phone";
import { listCalls } from "@/services/follow-ups";

export const metadata: Metadata = { title: "Call log" };

const OUTCOMES = [
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "FOLLOW_UP", label: "Follow up" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Seconds to "4m 12s". */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

/** The advert's host, or the raw value if it will not parse. */
function adHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAccess();
  const params = await searchParams;

  const result = await listCalls(context, {
    search: params.q,
    outcome: params.outcome,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <>
      <PageHeader
        title="Call log"
        subtitle="Every attempt on every number, kept permanently."
        actions={
          <Link href="/calls/new" className="btn btn--primary">
            <PhoneCall size={15} />
            Start call
          </Link>
        }
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search number, landlord or note..." />

          <FilterSelect
            paramName="outcome"
            label="Outcome"
            allLabel="All outcomes"
            options={OUTCOMES}
          />

          <ClearFilters keys={["q", "outcome"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<PhoneCall size={18} />}
            title="No calls yet"
            message="Look a number up to start your first call. Every attempt is logged here."
            action={
              <Link href="/calls/new" className="btn btn--primary btn--sm">
                Start call
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Landlord</th>
                  <th>Called by</th>
                  <th>Agent</th>
                  <th>Started</th>
                  <th className="numeric">Duration</th>
                  <th className="numeric">Attempt</th>
                  <th>Outcome</th>
                  <th>Advert</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="numeric table-primary">
                      {displayPhone(row.originalPhone, row.normalizedPhone)}
                    </td>

                    <td>
                      {row.landlordId ? (
                        <Link href={`/landlords/${row.landlordId}`}>{row.landlordName}</Link>
                      ) : (
                        <span className="subtle">Not a landlord yet</span>
                      )}
                    </td>

                    <td>
                      <Person name={row.calledBy?.fullName} src={row.calledBy?.avatarUrl} />
                    </td>

                    <td>
                      <Person name={row.agent?.fullName} src={row.agent?.avatarUrl} />
                    </td>

                    <td className="table-secondary">{formatDateTime(row.startedAt)}</td>

                    <td className="numeric">{formatDuration(row.durationSeconds)}</td>

                    <td className="numeric">{row.attemptNumber}</td>

                    <td>
                      <StatusBadge status={row.outcome ?? row.status} />
                    </td>

                    <td className="table-secondary truncate" style={{ maxWidth: 180 }}>
                      {row.adUrl ? (
                        <a href={row.adUrl} target="_blank" rel="noopener noreferrer">
                          {adHost(row.adUrl)}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="table-secondary truncate" style={{ maxWidth: 240 }}>
                      {row.notes ?? row.openingNote ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={result.pageSize}
        />
      </div>
    </>
  );
}
