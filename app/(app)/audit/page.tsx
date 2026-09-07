import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page-guard";
import { ScrollText } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDateTime } from "@/lib/dates";
import { listAuditActors, listAuditLog } from "@/services/users";

export const metadata: Metadata = { title: "Audit log" };

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "ARCHIVE",
  "RESTORE",
  "PUBLISH",
  "UNPUBLISH",
  "ASSIGN",
  "REASSIGN",
  "STAGE_CHANGE",
  "OVERRIDE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "PHONE_CORRECTION",
  "COMMISSION_CHANGE",
  "PERMISSION_CHANGE",
];

/** Compact JSON preview for the before/after columns. */
function preview(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const text = JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAdmin();
  const params = await searchParams;

  const [result, actors] = await Promise.all([
    listAuditLog(context, {
      search: params.q,
      action: params.action,
      entityType: params.entity,
      userId: params.user,
      page: params.page ? Number(params.page) : 1,
    }),
    listAuditActors(),
  ]);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Append-only. Nothing in the application ever edits or removes a row here."
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search record or user..." />

          <FilterSelect
            paramName="action"
            label="Action"
            allLabel="All actions"
            options={ACTIONS.map((action) => ({
              value: action,
              label: action.replace(/_/g, " ").toLowerCase(),
            }))}
          />

          <FilterSelect
            paramName="user"
            label="User"
            allLabel="All users"
            options={actors.map((actor) => ({ value: actor.id, label: actor.fullName }))}
          />

          <ClearFilters keys={["q", "action", "entity", "user"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={18} />}
            title="Nothing recorded"
            message="Sign-ins, ownership changes, publishing, commission changes and overrides all appear here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="table-secondary" style={{ whiteSpace: "nowrap" }}>
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="table-secondary">{row.userLabel ?? "System"}</td>
                    <td>
                      <StatusBadge
                        status={row.action}
                        label={row.action.replace(/_/g, " ").toLowerCase()}
                      />
                    </td>
                    <td>
                      <span className="table-primary">{row.entityType}</span>
                      {row.entityLabel && (
                        <div className="table-secondary truncate" style={{ maxWidth: 200 }}>
                          {row.entityLabel}
                        </div>
                      )}
                    </td>
                    <td className="table-secondary truncate" style={{ maxWidth: 220 }}>
                      <code style={{ fontSize: "0.72rem" }}>{preview(row.before)}</code>
                    </td>
                    <td className="table-secondary truncate" style={{ maxWidth: 220 }}>
                      <code style={{ fontSize: "0.72rem" }}>{preview(row.after)}</code>
                    </td>
                    <td className="table-secondary numeric">{row.ip ?? "-"}</td>
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
