import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDate, formatRelative } from "@/lib/dates";
import { listDealsByStage } from "@/services/deals";
import PipelineOutcome from "../viewings/PipelineOutcome";
import DealRowActions from "../viewings/DealRowActions";

export const metadata: Metadata = { title: "Verifications" };

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAgentOrAdmin();
  const params = await searchParams;

  const result = await listDealsByStage(context, "VERIFICATION", {
    search: params.q,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <>
      <PageHeader
        title="Verifications"
        subtitle="Deals waiting on checks before the tenancy can be closed. A failed verification returns the deal to viewing rather than ending it."
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search tenant, property or reference..." />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck size={18} />}
            title="Nothing in verification"
            message="Deals arrive here when a viewing is marked successful."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Tenant</th>
                  <th>Property agent</th>
                  <th>Tenant agent</th>
                  <th>Started</th>
                  <th>Last update</th>
                  <th className="table-actions"><span className="sr-only">Actions</span></th>
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
                      <Person name={row.propertyAgent?.fullName} src={row.propertyAgent?.avatarUrl} />
                    </td>
                    <td>
                      {row.tenantAgent ? (
                        <Person name={row.tenantAgent.fullName} src={row.tenantAgent.avatarUrl} />
                      ) : (
                        <span className="subtle small">Same agent</span>
                      )}
                      {row.collaborationId && (
                        <div><StatusBadge status="ACCEPTED" label="Cross sell" /></div>
                      )}
                    </td>
                    <td className="table-secondary">{formatDate(row.startedAt)}</td>
                    <td className="table-secondary">{formatRelative(row.updatedAt)}</td>
                    <td className="table-actions">
                      <PipelineOutcome
                        stage="VERIFICATION"
                        dealId={row.id}
                        propertyId={row.propertyId}
                        compact
                      />
                      <DealRowActions
                        dealId={row.id}
                        propertyId={row.propertyId}
                        label={row.propertyTitle ?? "this deal"}
                        isAdmin={context.isAdmin}
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
