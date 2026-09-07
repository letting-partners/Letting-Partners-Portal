import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { PhoneOff } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDate } from "@/lib/dates";
import { displayPhone } from "@/lib/phone";
import { listNotInterested } from "@/services/follow-ups";

export const metadata: Metadata = { title: "Not interested" };

const REASONS = [
  { value: "ALREADY_USING_AGENT", label: "Already using another agent" },
  { value: "NOT_CURRENTLY_RENTING", label: "Not currently renting" },
  { value: "NO_AGENCY_SERVICE", label: "Does not want an agency" },
  { value: "PROPERTY_SOLD", label: "Property sold" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "DO_NOT_CONTACT", label: "Asked not to be contacted" },
  { value: "OTHER", label: "Other" },
];

export default async function NotInterestedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAccess();
  const params = await searchParams;

  const result = await listNotInterested(context, {
    search: params.q,
    reason: params.reason,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <>
      <PageHeader
        title="Not interested"
        subtitle="Every attempt is kept. Retrying a number adds a new attempt rather than replacing the last one."
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search number, name or note..." />

          <FilterSelect
            paramName="reason"
            label="Reason"
            allLabel="All reasons"
            options={REASONS}
          />

          <ClearFilters keys={["q", "reason"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<PhoneOff size={18} />}
            title="Nothing recorded"
            message="Numbers marked not interested during a call will be listed here, with the full attempt history."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Reason</th>
                  <th>Last note</th>
                  <th>Attempted by</th>
                  <th className="numeric">Attempts</th>
                  <th>Date</th>
                  <th className="table-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="table-primary">{row.contactName ?? "Unknown contact"}</div>
                      <div className="table-secondary numeric">
                        {displayPhone(row.originalPhone, row.normalizedPhone)}
                      </div>
                    </td>

                    <td>
                      <StatusBadge status={row.reason} />
                    </td>

                    <td className="truncate" style={{ maxWidth: 300 }}>
                      {row.notes ?? "-"}
                    </td>

                    <td>
                      <Person name={row.createdBy?.fullName} src={row.createdBy?.avatarUrl} />
                    </td>

                    <td className="numeric">{row.attemptNumber}</td>

                    <td className="table-secondary">{formatDate(row.createdAt)}</td>

                    <td className="table-actions">
                      <Link
                        href={`/calls/new?phone=${encodeURIComponent(row.normalizedPhone)}`}
                        className="btn btn--secondary btn--sm"
                      >
                        Retry
                      </Link>
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
