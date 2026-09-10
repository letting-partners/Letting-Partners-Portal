import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import { CalendarClock } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDateTime, followUpTimeState } from "@/lib/dates";
import { displayPhone } from "@/lib/phone";
import { listFollowUps, type FollowUpFilter } from "@/services/follow-ups";
import FollowUpRowActions from "./FollowUpRowActions";
import { StartCallButton } from "@/components/calls/StartCall";

export const metadata: Metadata = { title: "Follow ups" };

const FILTERS: { value: FollowUpFilter; label: string }[] = [
  { value: "due", label: "Due today and overdue" },
  { value: "overdue", label: "Overdue only" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAccess();
  const params = await searchParams;

  const filter = (FILTERS.find((item) => item.value === params.filter)?.value ??
    "all") as FollowUpFilter;

  const result = await listFollowUps(context, {
    filter,
    search: params.q,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <>
      <PageHeader
        title="Follow ups"
        subtitle="A scheduled follow-up locks the number to whoever created it until it is completed or cancelled."
        actions={
          <StartCallButton />
        }
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search name, number or note..." />

          <FilterSelect
            paramName="filter"
            label="Status"
            allLabel="All follow ups"
            options={FILTERS.map((item) => ({ value: item.value, label: item.label }))}
          />

          <ClearFilters keys={["q", "filter"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={18} />}
            title="No follow-ups due"
            message="Numbers you schedule for later will appear here, with the overdue ones at the top."
            action={
              <StartCallButton className="btn btn--primary btn--sm" />
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Due</th>
                  <th>Priority</th>
                  <th>Last note</th>
                  <th>Created by</th>
                  <th>Status</th>
                  <th className="table-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => {
                  const timeState =
                    row.status === "SCHEDULED" ? followUpTimeState(row.dueAt) : null;

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="table-primary">
                          {row.contactName ?? "Unknown contact"}
                        </div>
                        <div className="table-secondary numeric">
                          {displayPhone(row.originalPhone, row.normalizedPhone)}
                        </div>
                      </td>

                      <td>
                        {timeState && <StatusBadge status={timeState} />}
                        <div className="table-secondary">{formatDateTime(row.dueAt)}</div>
                      </td>

                      <td>
                        <StatusBadge status={row.priority} />
                      </td>

                      <td className="truncate" style={{ maxWidth: 280 }}>
                        {row.notes}
                      </td>

                      <td>
                        <Person
                          name={row.createdBy?.fullName}
                          src={row.createdBy?.avatarUrl}
                          meta={row.isOwner ? "You" : undefined}
                        />
                      </td>

                      <td>
                        <StatusBadge status={row.status} />
                      </td>

                      <td className="table-actions">
                        <FollowUpRowActions
                          followUpId={row.id}
                          normalizedPhone={row.normalizedPhone}
                          status={row.status}
                          canRetry={row.canRetry}
                          isOwner={row.isOwner}
                          dueAt={row.dueAt.toISOString()}
                        />
                      </td>
                    </tr>
                  );
                })}
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
