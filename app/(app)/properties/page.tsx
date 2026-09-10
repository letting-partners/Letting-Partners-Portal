import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, Plus } from "lucide-react";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import {
  ClearFilters,
  FilterSelect,
  Pagination,
  SearchInput,
} from "@/components/ui/TableControls";
import { formatDate } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { listProperties } from "@/services/properties";
import { listAssignableAgents, listAssignableFronters } from "@/services/properties";
import PropertyRowActions from "./PropertyRowActions";

export const metadata: Metadata = { title: "Properties" };

const FILTER_KEYS = ["q", "type", "listing", "stage", "agent", "outcode"];

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAccess();
  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="Every property you and your team have onboarded."
        actions={
          <Link href="/properties/new" className="btn btn--primary">
            <Plus size={15} />
            Add property
          </Link>
        }
      />

      <Suspense fallback={<div className="card">{<TableSkeleton />}</div>}>
        <PropertiesTable params={params} isAdmin={context.isAdmin} />
      </Suspense>
    </>
  );
}

async function PropertiesTable({
  params,
  isAdmin,
}: {
  params: Record<string, string | undefined>;
  isAdmin: boolean;
}) {
  const context = await pageAccess();

  const [result, agents, fronters] = await Promise.all([
    listProperties(context, {
      search: params.q,
      propertyType: params.type === "SHARED" ? "SHARED" : params.type === "FULL" ? "FULL" : undefined,
      listingStatus: params.listing,
      dealStage: params.stage,
      agentId: params.agent,
      outcode: params.outcode,
      page: params.page ? Number(params.page) : 1,
    }),
    isAdmin ? listAssignableAgents() : Promise.resolve([]),
    isAdmin ? listAssignableFronters() : Promise.resolve([]),
  ]);

  return (
    <div className="card">
      <div className="filter-bar">
        <SearchInput placeholder="Search reference, address, postcode or landlord..." />

        <FilterSelect
          paramName="type"
          label="Property type"
          allLabel="All types"
          options={[
            { value: "FULL", label: "Full property" },
            { value: "SHARED", label: "Shared property" },
          ]}
        />

        <FilterSelect
          paramName="listing"
          label="Website status"
          allLabel="All website statuses"
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "READY_TO_PUBLISH", label: "Ready to publish" },
            { value: "PUBLISHED", label: "Published" },
            { value: "UNPUBLISHED", label: "Unpublished" },
            { value: "LET_AGREED", label: "Let agreed" },
          ]}
        />

        <FilterSelect
          paramName="stage"
          label="Deal stage"
          allLabel="All deal stages"
          options={[
            { value: "AVAILABLE", label: "Available" },
            { value: "VIEWING", label: "Viewing" },
            { value: "VERIFICATION", label: "Verification" },
            { value: "CLOSING", label: "Closing" },
            { value: "CLOSED_SUCCESSFUL", label: "Closed" },
          ]}
        />

        {isAdmin && agents.length > 0 && (
          <FilterSelect
            paramName="agent"
            label="Agent"
            allLabel="All agents"
            options={agents.map((agent) => ({ value: agent.id, label: agent.fullName }))}
          />
        )}

        <ClearFilters keys={FILTER_KEYS} />
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={<Building2 size={18} />}
          title="No properties yet"
          message="Add your first landlord property, or clear the filters to see everything."
          action={
            <Link href="/properties/new" className="btn btn--primary btn--sm">
              Add property
            </Link>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Landlord</th>
                <th>Type</th>
                <th className="numeric">Rent</th>
                <th>Website</th>
                <th>Deal stage</th>
                <th>Fronter</th>
                <th>Agent</th>
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
                    <Link href={`/properties/${row.id}`} className="table-primary">
                      {row.title ?? row.formattedAddress}
                    </Link>
                    <div className="table-secondary">
                      {row.reference} · {row.postcode}
                    </div>
                  </td>

                  <td>
                    <Link href={`/landlords/${row.landlordId}`}>{row.landlordName}</Link>
                  </td>

                  <td>
                    {row.propertyType === "SHARED" ? (
                      <>
                        Shared
                        <div className="table-secondary">
                          {row.roomsAvailable} of {row.roomsTotal} rooms free
                        </div>
                      </>
                    ) : (
                      <>
                        {row.category === "STUDIO_FLAT"
                          ? "Studio flat"
                          : row.category === "FLAT"
                            ? "Flat"
                            : "House"}
                        {row.numberOfRooms != null && (
                          <div className="table-secondary">
                            {row.availableRooms ?? 0} of {row.numberOfRooms} rooms free
                          </div>
                        )}
                      </>
                    )}
                  </td>

                  <td className="numeric">
                    {row.propertyType === "SHARED"
                      ? row.fromRentPence
                        ? `from ${formatGBP(row.fromRentPence)}`
                        : "-"
                      : formatGBP(row.rentPerMonthPence)}
                  </td>

                  <td>
                    <StatusBadge status={row.listingStatus} />
                  </td>

                  <td>
                    <StatusBadge status={row.dealStage} />
                  </td>

                  <td>
                    <Person name={row.fronter?.fullName} src={row.fronter?.avatarUrl} />
                  </td>

                  <td>
                    <Person name={row.agent?.fullName} src={row.agent?.avatarUrl} />
                  </td>

                  <td className="table-secondary">{formatDate(row.createdAt)}</td>

                  <td className="table-actions">
                    <PropertyRowActions
                      propertyId={row.id}
                      listingStatus={row.listingStatus}
                      isFeatured={row.isFeatured}
                      isAdmin={context.isAdmin}
                      agents={agents}
                      fronters={fronters}
                      assignedAgentId={row.assignedAgentId}
                      originatingFronterId={row.originatingFronterId}
                      label={row.title ?? row.reference}
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
  );
}
