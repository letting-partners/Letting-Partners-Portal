import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { Contact, Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Person } from "@/components/ui/Avatar";
import {
  ClearFilters,
  FilterSelect,
  Pagination,
  SearchInput,
} from "@/components/ui/TableControls";
import { formatDate, formatRelative } from "@/lib/dates";
import { displayPhone } from "@/lib/phone";
import { listLandlords } from "@/services/landlords";
import { listAssignableAgents, listAssignableFronters } from "@/services/properties";
import { canEditLandlord } from "@/services/permissions";
import LandlordRowActions from "./LandlordRowActions";
import { StartCallButton } from "@/components/calls/StartCall";

export const metadata: Metadata = { title: "Landlords" };

const FILTER_KEYS = ["q", "agent", "sort"];

export default async function LandlordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAccess();
  const params = await searchParams;

  const [result, agents, fronters] = await Promise.all([
    listLandlords(context, {
      search: params.q,
      agentId: params.agent,
      sort: params.sort === "name" ? "name" : params.sort === "lastContact" ? "lastContact" : "recent",
      page: params.page ? Number(params.page) : 1,
    }),
    context.isAdmin ? listAssignableAgents() : Promise.resolve([]),
    context.isAdmin ? listAssignableFronters() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Landlords"
        subtitle="Every landlord is identified by their phone number, so the same person can never be added twice."
        actions={
          <Link href="/properties/new" className="btn btn--primary">
            <Plus size={15} />
            Add landlord
          </Link>
        }
      />

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search name, email or phone number..." />

          {context.isAdmin && agents.length > 0 && (
            <FilterSelect
              paramName="agent"
              label="Agent"
              allLabel="All agents"
              options={agents.map((agent) => ({ value: agent.id, label: agent.fullName }))}
            />
          )}

          <FilterSelect
            paramName="sort"
            label="Sort"
            allLabel="Newest first"
            options={[
              { value: "name", label: "Name A-Z" },
              { value: "lastContact", label: "Last contact" },
            ]}
          />

          <ClearFilters keys={FILTER_KEYS} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<Contact size={18} />}
            title="No landlords yet"
            message="Landlords are created from the call workflow when a call goes well, or added directly."
            action={
              <StartCallButton className="btn btn--primary btn--sm" />
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Landlord</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th className="numeric">Properties</th>
                  <th>Fronter</th>
                  <th>Agent</th>
                  <th>Last contact</th>
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
                      <Link href={`/landlords/${row.id}`} className="table-primary">
                        {row.name}
                      </Link>
                    </td>
                    <td className="numeric">
                      {displayPhone(row.originalPhone, row.normalizedPhone)}
                    </td>
                    <td className="table-secondary">{row.email ?? "-"}</td>
                    <td className="numeric">{row.propertyCount}</td>
                    <td>
                      <Person name={row.fronter?.fullName} src={row.fronter?.avatarUrl} />
                    </td>
                    <td>
                      <Person name={row.agent?.fullName} src={row.agent?.avatarUrl} />
                    </td>
                    <td className="table-secondary">
                      {row.lastContactAt ? formatRelative(row.lastContactAt) : "-"}
                    </td>
                    <td className="table-secondary">{formatDate(row.createdAt)}</td>
                    <td className="table-actions">
                      <LandlordRowActions
                        landlord={{
                          id: row.id,
                          name: row.name,
                          email: row.email,
                          alternatePhone: row.alternatePhone ?? null,
                          gender: row.gender ?? null,
                          propertyCount: row.propertyCount,
                          phone: row.originalPhone,
                          assignedAgentId: row.assignedAgentId,
                          originatingFronterId: row.originatingFronterId,
                        }}
                        canEdit={canEditLandlord(context, {
                          originatingFronterId: row.originatingFronterId,
                          assignedAgentId: row.assignedAgentId,
                        })}
                        isAdmin={context.isAdmin}
                        agents={agents}
                        fronters={fronters}
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
