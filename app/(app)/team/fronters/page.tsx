import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page-guard";
import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDate, formatRelative } from "@/lib/dates";
import { listAgents, listUsers } from "@/services/users";
import UserForm from "../UserForm";
import UserRowActions from "../UserRowActions";

export const metadata: Metadata = { title: "Fronters" };

export default async function FrontersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAdmin();
  const params = await searchParams;

  const [result, agents] = await Promise.all([
    listUsers(context, {
      search: params.q,
      role: "FRONTER",
      agentId: params.agent,
      page: params.page ? Number(params.page) : 1,
    }),
    listAgents(),
  ]);

  return (
    <>
      <PageHeader
        title="Fronters"
        subtitle="Fronters acquire landlords by phone. Each one reports to exactly one agent."
        actions={<UserForm agents={agents} defaultRole="FRONTER" label="Add fronter" />}
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search name or email..." />

          <FilterSelect
            paramName="agent"
            label="Reports to"
            allLabel="All agents"
            options={agents.map((agent) => ({ value: agent.id, label: agent.fullName }))}
          />

          <ClearFilters keys={["q", "agent"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<Users size={18} />}
            title="No fronters yet"
            message="Add a fronter and assign them to an agent to start landlord acquisition."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fronter</th>
                  <th>Email</th>
                  <th>Reports to</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Created</th>
                  <th className="table-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Person name={row.fullName} src={row.avatarUrl} meta={row.jobTitle} />
                    </td>
                    <td className="table-secondary">{row.email}</td>
                    <td>
                      {row.assignedAgent ? (
                        <Person
                          name={row.assignedAgent.fullName}
                          src={row.assignedAgent.avatarUrl}
                        />
                      ) : (
                        <span className="badge badge--danger">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="table-secondary">
                      {row.lastLoginAt ? formatRelative(row.lastLoginAt) : "Never"}
                    </td>
                    <td className="table-secondary">{formatDate(row.createdAt)}</td>
                    <td className="table-actions">
                      <UserRowActions
                        userId={row.id}
                        fullName={row.fullName}
                        status={row.status}
                        isSelf={row.id === context.user.id}
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
