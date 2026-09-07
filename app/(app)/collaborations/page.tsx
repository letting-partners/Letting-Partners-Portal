import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import Link from "next/link";
import { Repeat2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, FilterSelect, Pagination } from "@/components/ui/TableControls";
import { formatDate, formatRelative } from "@/lib/dates";
import { formatPercent } from "@/lib/money";
import { listCollaborations } from "@/services/cross-sell";
import CollaborationActions from "./CollaborationActions";

export const metadata: Metadata = { title: "Collaborations" };

export default async function CollaborationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAgentOrAdmin();
  const params = await searchParams;

  const result = await listCollaborations(context, {
    status: params.status,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <>
      <PageHeader
        title="Collaborations"
        subtitle="Cross-sell deals shared between two agents. The commission split is frozen when a request is accepted."
        actions={
          <Link href="/cross-sell" className="btn btn--primary">
            <Repeat2 size={15} />
            Find a property
          </Link>
        }
      />

      <div className="card">
        <div className="filter-bar">
          <FilterSelect
            paramName="status"
            label="Status"
            allLabel="All statuses"
            options={[
              { value: "PENDING", label: "Pending" },
              { value: "ACCEPTED", label: "Accepted" },
              { value: "DECLINED", label: "Declined" },
              { value: "VIEWING", label: "Viewing" },
              { value: "VERIFICATION", label: "Verification" },
              { value: "CLOSING", label: "Closing" },
              { value: "CLOSED", label: "Closed" },
            ]}
          />
          <ClearFilters keys={["status"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<Repeat2 size={18} />}
            title="No collaborations yet"
            message="When you request a property from another agent, or they request one of yours, it appears here."
            action={
              <Link href="/cross-sell" className="btn btn--primary btn--sm">
                Find a property
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
                  <th>Tenant agent</th>
                  <th>Property agent</th>
                  <th>Split</th>
                  <th>Requested</th>
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

                    <td>{row.tenantName}</td>

                    <td>
                      <Person name={row.tenantAgent?.fullName} src={row.tenantAgent?.avatarUrl} />
                    </td>

                    <td>
                      <Person
                        name={row.propertyAgent?.fullName}
                        src={row.propertyAgent?.avatarUrl}
                      />
                    </td>

                    <td className="numeric">
                      {row.propertyAgentSplitBp != null && row.tenantAgentSplitBp != null ? (
                        <>
                          {formatPercent(row.propertyAgentSplitBp)} / {formatPercent(row.tenantAgentSplitBp)}
                          <div className="table-secondary">property / tenant</div>
                        </>
                      ) : (
                        <span className="subtle">Set on acceptance</span>
                      )}
                    </td>

                    <td className="table-secondary">
                      {formatDate(row.requestedAt)}
                      <div>{formatRelative(row.requestedAt)}</div>
                    </td>

                    <td>
                      <StatusBadge status={row.status} />
                      {row.declineReason && (
                        <div className="table-secondary truncate" style={{ maxWidth: 200 }}>
                          {row.declineReason}
                        </div>
                      )}
                    </td>

                    <td className="table-actions">
                      <CollaborationActions
                        collaborationId={row.id}
                        propertyId={row.propertyId}
                        canRespond={row.canRespond}
                        canStartViewing={row.canStartViewing}
                      />
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
