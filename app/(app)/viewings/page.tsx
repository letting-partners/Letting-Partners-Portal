import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDateTime } from "@/lib/dates";
import { listViewings } from "@/services/deals";
import PipelineOutcome from "./PipelineOutcome";

export const metadata: Metadata = { title: "Viewings" };

export default async function ViewingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAgentOrAdmin();
  const params = await searchParams;

  const result = await listViewings(context, {
    status: params.status,
    search: params.q,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <>
      <PageHeader
        title="Viewings"
        subtitle="Every viewing attempt is kept, whether it went ahead or not."
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search tenant, property or reference..." />

          <FilterSelect
            paramName="status"
            label="Status"
            allLabel="All viewings"
            options={[
              { value: "SCHEDULED", label: "Scheduled" },
              { value: "COMPLETED_SUCCESSFUL", label: "Successful" },
              { value: "COMPLETED_UNSUCCESSFUL", label: "Unsuccessful" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
          />

          <ClearFilters keys={["q", "status"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={18} />}
            title="No viewings yet"
            message="Start a viewing from a property to open a deal and begin the pipeline."
            action={
              <Link href="/properties" className="btn btn--primary btn--sm">
                Browse properties
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Tenant</th>
                  <th>Agent</th>
                  <th>Fronter</th>
                  <th>Scheduled</th>
                  <th className="numeric">Attempt</th>
                  <th>Status</th>
                  <th className="table-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/properties/${row.propertyId}`} className="table-primary">
                        {row.propertyTitle ?? row.propertyAddress}
                      </Link>
                      <div className="table-secondary">
                        {row.propertyReference}
                        {row.roomName ? ` · ${row.roomName}` : ""}
                      </div>
                    </td>

                    <td>
                      <Link href={`/tenants/${row.tenantId}`}>{row.tenantName}</Link>
                    </td>

                    <td>
                      <Person name={row.agent?.fullName} src={row.agent?.avatarUrl} />
                    </td>

                    <td>
                      <Person name={row.fronter?.fullName} src={row.fronter?.avatarUrl} />
                    </td>

                    <td className="table-secondary">{formatDateTime(row.scheduledFor)}</td>

                    <td className="numeric">{row.attemptNumber}</td>

                    <td>
                      <StatusBadge status={row.status} />
                      {row.outcomeReason && (
                        <div className="table-secondary truncate" style={{ maxWidth: 200 }}>
                          {row.outcomeReason}
                        </div>
                      )}
                    </td>

                    <td className="table-actions">
                      {row.status === "SCHEDULED" && (
                        <PipelineOutcome
                          stage="VIEWING"
                          dealId={row.dealId}
                          viewingId={row.id}
                          propertyId={row.propertyId}
                          compact
                        />
                      )}
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
