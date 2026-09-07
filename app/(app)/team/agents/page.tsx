import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page-guard";
import Link from "next/link";
import { UserCog } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDate, formatRelative } from "@/lib/dates";
import { listAgents, listUsers } from "@/services/users";
import UserForm from "../UserForm";
import UserRowActions from "../UserRowActions";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAdmin();
  const params = await searchParams;

  const [result, agents] = await Promise.all([
    listUsers(context, {
      search: params.q,
      role: "AGENT",
      page: params.page ? Number(params.page) : 1,
    }),
    listAgents(),
  ]);

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Agents manage properties, tenants and the letting pipeline, and lead a team of fronters."
        actions={<UserForm agents={agents} defaultRole="AGENT" label="Add agent" />}
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search name or email..." />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<UserCog size={18} />}
            title="No agents yet"
            message="Add an agent to start building a team."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Email</th>
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

      <p className="subtle small" style={{ marginTop: 12 }}>
        Looking for the whole staff list? <Link href="/team/users">All users</Link>.
      </p>
    </>
  );
}
