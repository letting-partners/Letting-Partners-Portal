import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page-guard";
import { ShieldCheck } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDate, formatRelative } from "@/lib/dates";
import { displayPhone } from "@/lib/phone";
import { listAgents, listUsers } from "@/services/users";
import UserForm from "../UserForm";
import UserRowActions from "../UserRowActions";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAdmin();
  const params = await searchParams;

  const [result, agents] = await Promise.all([
    listUsers(context, {
      search: params.q,
      role: params.role as never,
      status: params.status,
      page: params.page ? Number(params.page) : 1,
    }),
    listAgents(),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Everyone with access to the portal. Creating an account is what grants access - there is no password."
        actions={<UserForm agents={agents} label="Add user" />}
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search name or email..." />

          <FilterSelect
            paramName="role"
            label="Role"
            allLabel="All roles"
            options={[
              { value: "SUPER_ADMIN", label: "Super admin" },
              { value: "AGENT", label: "Agent" },
              { value: "FRONTER", label: "Fronter" },
            ]}
          />

          <FilterSelect
            paramName="status"
            label="Status"
            allLabel="All statuses"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "SUSPENDED", label: "Suspended" },
            ]}
          />

          <ClearFilters keys={["q", "role", "status"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={18} />}
            title="No users match"
            message="Clear the filters, or add the first account."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Reports to</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Created</th>
                  <th className="table-actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Person name={row.fullName} src={row.avatarUrl} meta={row.jobTitle} />
                    </td>
                    <td>
                      <StatusBadge status={row.role} />
                    </td>
                    <td className="table-secondary">{row.email}</td>
                    <td className="numeric table-secondary">
                      {row.phone ? displayPhone(row.phone, null) : "-"}
                    </td>
                    <td>
                      {row.assignedAgent ? (
                        <Person name={row.assignedAgent.fullName} src={row.assignedAgent.avatarUrl} />
                      ) : (
                        <span className="subtle">-</span>
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
