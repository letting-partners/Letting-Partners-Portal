import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDate, formatDateOnly } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { displayPhone } from "@/lib/phone";
import { listTenants } from "@/services/tenants";
import { listAssignableAgents } from "@/services/properties";
import TenantForm from "./TenantForm";
import TenantRowActions from "./TenantRowActions";
import { canEditTenant } from "@/services/permissions";

export const metadata: Metadata = { title: "Tenants" };

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAgentOrAdmin();
  const params = await searchParams;

  const [result, agents] = await Promise.all([
    listTenants(context, {
      search: params.q,
      status: params.status,
      agentId: params.agent,
      page: params.page ? Number(params.page) : 1,
    }),
    context.isAdmin ? listAssignableAgents() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle="Applicants you are looking to place. Each one belongs to the agent who registered them."
        actions={
          <TenantForm
            trigger={
              <button type="button" className="btn btn--primary">
                <Plus size={15} />
                Register tenant
              </button>
            }
          />
        }
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search name, phone, area or requirements..." />

          <FilterSelect
            paramName="status"
            label="Status"
            allLabel="All statuses"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "VIEWING", label: "Viewing" },
              { value: "NEGOTIATING", label: "Negotiating" },
              { value: "PLACED", label: "Placed" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />

          {context.isAdmin && agents.length > 0 && (
            <FilterSelect
              paramName="agent"
              label="Agent"
              allLabel="All agents"
              options={agents.map((agent) => ({ value: agent.id, label: agent.fullName }))}
            />
          )}

          <ClearFilters keys={["q", "status", "agent"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<UsersRound size={18} />}
            title="No tenants yet"
            message="Register an applicant to start matching them against your properties, or search across the business with Cross sell."
            action={
              <TenantForm
                trigger={
                  <button type="button" className="btn btn--primary btn--sm">
                    Register tenant
                  </button>
                }
              />
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Phone</th>
                  <th>Area</th>
                  <th className="numeric">Budget</th>
                  <th>Move in</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th>Registered</th>
                  <th className="table-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/tenants/${row.id}`} className="table-primary">
                        {row.name}
                      </Link>
                      {row.requirements && (
                        <div className="table-secondary truncate" style={{ maxWidth: 260 }}>
                          {row.requirements}
                        </div>
                      )}
                    </td>

                    <td className="numeric">
                      {displayPhone(row.originalPhone, row.normalizedPhone)}
                    </td>

                    <td>
                      {row.area ?? "-"}
                      {row.postcodePreferences && (
                        <div className="table-secondary">{row.postcodePreferences}</div>
                      )}
                    </td>

                    <td className="numeric">
                      {row.maxBudgetPence
                        ? `up to ${formatGBP(row.maxBudgetPence)}`
                        : row.minBudgetPence
                          ? `from ${formatGBP(row.minBudgetPence)}`
                          : "-"}
                    </td>

                    <td className="table-secondary">{formatDateOnly(row.moveInDate)}</td>

                    <td>
                      <StatusBadge status={row.status} />
                    </td>

                    <td>
                      <Person name={row.ownerAgent?.fullName} src={row.ownerAgent?.avatarUrl} />
                    </td>

                    <td className="table-secondary">{formatDate(row.createdAt)}</td>

                    <td className="table-actions">
                      <TenantRowActions
                        tenant={{
                          id: row.id,
                          name: row.name,
                          email: row.email,
                          area: row.area,
                          postcodePreferences: row.postcodePreferences,
                          requirements: row.requirements,
                          status: row.status,
                          roomType: row.roomType,
                          occupants: row.occupants,
                          monthlyIncomePence: row.monthlyIncomePence,
                          occupation: row.occupation,
                          countryOfOrigin: row.countryOfOrigin,
                          minBudgetPence: row.minBudgetPence,
                          maxBudgetPence: row.maxBudgetPence,
                          moveInDate: row.moveInDate,
                          bedrooms: row.bedrooms,
                          propertyTypePreference: row.propertyTypePreference,
                          ownerAgentId: row.ownerAgentId,
                        }}
                        canEdit={canEditTenant(context, { ownerAgentId: row.ownerAgentId })}
                        isAdmin={context.isAdmin}
                        agents={agents}
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
