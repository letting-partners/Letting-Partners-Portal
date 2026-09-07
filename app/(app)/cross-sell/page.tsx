import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import Link from "next/link";
import { Repeat2, Search } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDateOnly } from "@/lib/dates";
import { formatGBP, poundsToPence } from "@/lib/money";
import { searchCrossSell } from "@/services/cross-sell";
import { listBookableRooms } from "@/services/deals";
import { listSelectableTenants } from "@/services/tenants";
import RequestCollaboration from "./RequestCollaboration";

export const metadata: Metadata = { title: "Cross sell" };

const FILTER_KEYS = ["q", "outcode", "type", "minRent", "maxRent", "beds", "wide"];

export default async function CrossSellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAgentOrAdmin();
  const params = await searchParams;

  const [result, tenants] = await Promise.all([
    searchCrossSell(context, {
      area: params.q,
      outcode: params.outcode,
      propertyType:
        params.type === "SHARED" ? "SHARED" : params.type === "FULL" ? "FULL" : undefined,
      minRentPence: poundsToPence(params.minRent) ?? undefined,
      maxRentPence: poundsToPence(params.maxRent) ?? undefined,
      bedrooms: params.beds ? Number(params.beds) : undefined,
      wholeArea: params.wide === "1",
      page: params.page ? Number(params.page) : 1,
    }),
    listSelectableTenants(context),
  ]);

  // Rooms are only needed for the shared properties actually on screen.
  const sharedIds = result.rows.filter((row) => row.propertyType === "SHARED").map((row) => row.id);
  const roomsByProperty = new Map<
    string,
    { id: string; name: string; rentPerMonthPence: number; status: string }[]
  >();

  await Promise.all(
    sharedIds.map(async (propertyId) => {
      const rooms = await listBookableRooms(propertyId);
      roomsByProperty.set(
        propertyId,
        rooms.map((room) => ({
          id: room.id,
          name: room.name,
          rentPerMonthPence: room.rentPerMonthPence,
          status: room.status,
        })),
      );
    }),
  );

  return (
    <>
      <PageHeader
        title="Cross sell"
        subtitle="Find a property for your tenant anywhere in the business. Landlord details and commission stay with the property agent."
        actions={
          <Link href="/collaborations" className="btn btn--secondary">
            <Repeat2 size={15} />
            My collaborations
          </Link>
        }
      />

      {tenants.length === 0 && (
        <div className="alert alert--info" style={{ marginBottom: 16 }}>
          <span>
            You have no active tenants yet. <Link href="/tenants">Register a tenant</Link> before
            sending a cross-sell request.
          </span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filter-bar" style={{ borderRadius: "var(--radius)" }}>
          <SearchInput placeholder="Search by area, e.g. Rusholme" />

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
            paramName="wide"
            label="Search radius"
            allLabel="Exact outcode"
            options={[{ value: "1", label: "Whole postcode area" }]}
          />

          <ClearFilters keys={FILTER_KEYS} />
        </div>
      </div>

      {result.rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Search size={18} />}
            title="No matching properties found"
            message="Try expanding the area or the price range, or search the whole postcode area."
          />
        </div>
      ) : (
        <>
          <div className="image-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {result.rows.map((row) => (
              <article key={row.id} className="card">
                <div className="card-body stack--sm stack">
                  <div className="row row--between">
                    <StatusBadge status={row.listingStatus} />
                    {row.isMine && <span className="badge badge--accent">Yours</span>}
                  </div>

                  <h3 style={{ fontSize: "0.95rem" }}>
                    {row.title ?? `${row.category ?? "Property"} in ${row.area ?? row.outcode}`}
                  </h3>

                  <p className="muted small">
                    {row.area ? `${row.area}, ` : ""}
                    {row.outcode} · {row.propertyType === "SHARED" ? "Shared" : "Full property"}
                  </p>

                  <p className="property-card-rent">
                    {row.propertyType === "SHARED"
                      ? row.fromRentPence
                        ? `from ${formatGBP(row.fromRentPence)} pcm`
                        : "Rooms unavailable"
                      : `${formatGBP(row.rentPerMonthPence)} pcm`}
                  </p>

                  <p className="subtle small">
                    {row.propertyType === "SHARED"
                      ? `${row.availableRooms} of ${row.totalRooms} rooms available`
                      : row.availabilityDate
                        ? `Available from ${formatDateOnly(row.availabilityDate)}`
                        : "Availability on request"}
                  </p>

                  <div className="row row--between" style={{ marginTop: 4 }}>
                    <Person
                      name={row.propertyAgentName}
                      src={row.propertyAgentAvatar}
                      meta="Property agent"
                    />
                  </div>

                  {row.isMine ? (
                    <Link
                      href={`/viewings/new?propertyId=${row.id}`}
                      className="btn btn--secondary btn--sm btn--block"
                    >
                      Start viewing
                    </Link>
                  ) : (
                    <RequestCollaboration
                      property={{
                        id: row.id,
                        reference: row.reference,
                        label: row.title ?? `${row.area ?? ""} ${row.outcode}`.trim(),
                        propertyType: row.propertyType,
                        agentName: row.propertyAgentName,
                      }}
                      rooms={roomsByProperty.get(row.id) ?? []}
                      tenants={tenants.map((tenant) => ({
                        id: tenant.id,
                        name: tenant.name,
                        area: tenant.area,
                        maxBudgetPence: tenant.maxBudgetPence,
                      }))}
                    />
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              pageSize={result.pageSize}
            />
          </div>
        </>
      )}
    </>
  );
}
