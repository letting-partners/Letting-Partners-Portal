import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, KeyRound } from "lucide-react";
import { Card, DefinitionList, EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { NotesPanel } from "@/components/ui/NotesPanel";
import { Timeline } from "@/components/ui/Timeline";
import { formatDate, formatDateOnly, formatDateTime } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { displayPhone } from "@/lib/phone";
import { getProperty, FEATURE_LABELS, type PropertyFeatures } from "@/services/properties";
import { listDealsForProperty, listViewingsForProperty } from "@/services/deals";
import { listActivity, listNotes } from "@/services/notes";
import ListingEditor from "./ListingEditor";
import PropertyHeaderActions from "./PropertyHeaderActions";
import PropertyPhotos from "./PropertyPhotos";
import PropertyRecordEditor from "./PropertyRecordEditor";

type TabKey = "overview" | "rooms" | "listing" | "pipeline" | "activity" | "edit";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "rooms", label: "Rooms" },
  { key: "listing", label: "Public listing" },
  { key: "pipeline", label: "Pipeline" },
  { key: "activity", label: "Activity & notes" },
];

/** Editing the whole record is an admin correction path, not a daily task. */
const ADMIN_TABS: { key: TabKey; label: string }[] = [{ key: "edit", label: "Edit record" }];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const context = await pageAccess();
  const data = await getProperty(id, context).catch(() => null);
  if (!data) return { title: "Property" };
  return { title: data.property.title ?? data.property.reference };
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const context = await pageAccess();

  const data = await getProperty(id, context);
  if (!data) notFound();

  const { property, landlord, rooms, images, readiness } = data;
  const allowedTabs = [...TABS, ...(context.isAdmin ? ADMIN_TABS : [])];
  const activeTab: TabKey = allowedTabs.some((item) => item.key === tab)
    ? (tab as TabKey)
    : "overview";

  const [deals, viewings, notes, activity] = await Promise.all([
    listDealsForProperty(id),
    listViewingsForProperty(id),
    listNotes("PROPERTY", id),
    listActivity("Property", id),
  ]);

  const isShared = property.propertyType === "SHARED";
  const availableRooms = rooms.filter((room) => room.status === "AVAILABLE").length;

  return (
    <>
      <PageHeader
        title={property.title ?? property.formattedAddress}
        subtitle={
          <>
            {property.reference} · {property.formattedAddress}
          </>
        }
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          { label: property.reference },
        ]}
        actions={
          <PropertyHeaderActions
            propertyId={property.id}
            listingStatus={property.listingStatus}
            dealStage={property.dealStage}
            slug={property.slug}
            siteUrl={publicEnv.NEXT_PUBLIC_SITE_URL}
            canPublish={data.canPublish}
            canArchive={data.canArchive}
            canStartViewing={!context.isFronter && property.dealStage === "AVAILABLE"}
            publishReady={readiness.ready}
            publishMissing={readiness.missing}
          />
        }
      />

      <div className="row row--wrap" style={{ marginBottom: 16 }}>
        <StatusBadge status={property.listingStatus} />
        <StatusBadge status={property.dealStage} />
        <span className="badge badge--neutral">
          {isShared ? "Shared property" : property.category === "STUDIO_FLAT" ? "Studio flat" : property.category === "FLAT" ? "Flat" : "House"}
        </span>
        {isShared && (
          <span className="badge badge--neutral">
            {availableRooms} of {rooms.length} rooms available
          </span>
        )}
      </div>

      <nav className="tabs" style={{ marginBottom: 16 }} aria-label="Property sections">
        {[...TABS, ...(context.isAdmin ? ADMIN_TABS : [])].map((item) => (
          <Link
            key={item.key}
            href={`/properties/${id}?tab=${item.key}`}
            className="tab"
            aria-selected={activeTab === item.key}
            role="tab"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="grid-sidebar">
          <div className="stack">
            <Card title="Property details">
              <DefinitionList
                items={[
                  { term: "Reference", value: property.reference },
                  { term: "Address", value: property.formattedAddress },
                  { term: "Area", value: property.area ?? "-" },
                  { term: "Postcode", value: property.postcode },
                  {
                    term: "Type",
                    value: isShared
                      ? "Shared property"
                      : property.category === "STUDIO_FLAT"
                        ? "Studio flat"
                        : property.category === "FLAT"
                          ? "Flat"
                          : "House",
                  },
                  ...(isShared
                    ? []
                    : [
                        {
                          term: "Rooms",
                          value:
                            property.numberOfRooms == null
                              ? "-"
                              : `${property.availableRooms ?? 0} available of ${property.numberOfRooms}`,
                        },
                      ]),
                  { term: "Bathrooms", value: property.bathrooms ?? "-" },
                  {
                    term: "Living room",
                    value: property.livingRoom
                      ? property.livingRoom.charAt(0) + property.livingRoom.slice(1).toLowerCase()
                      : "-",
                  },
                  {
                    term: "Available from",
                    value: formatDateOnly(property.availabilityDate),
                  },
                ]}
              />
            </Card>

            <Card title="Features">
              <FeatureGrid property={property} />
            </Card>

            {!isShared && (
              <Card title="Financial details">
                <DefinitionList
                  items={[
                    {
                      term: "Rent",
                      value: (
                        <>
                          {formatGBP(property.rentPerMonthPence)} pcm
                          {property.rentPerWeekPence != null && (
                            <span className="subtle">
                              {" "}
                              (equivalent to {formatGBP(property.rentPerWeekPence)} pw)
                            </span>
                          )}
                        </>
                      ),
                    },
                    { term: "Deposit", value: formatGBP(property.depositPence) },
                    {
                      term: "Commission agreed",
                      value:
                        property.commissionValue == null
                          ? "-"
                          : property.commissionType === "PERCENTAGE"
                            ? `${property.commissionValue / 100}% of one month of rent`
                            : formatGBP(property.commissionValue),
                    },
                    {
                      term: "Estimated gross commission",
                      value: formatGBP(property.commissionAmountPence),
                    },
                  ]}
                />
              </Card>
            )}

            <Card
              title="Photos"
              actions={
                <Link href="/images" className="btn btn--ghost btn--sm">
                  Image library
                </Link>
              }
            >
              <PropertyPhotos
                propertyId={property.id}
                canEdit={data.canEdit}
                images={images.map((image) => ({
                  assetId: image.assetId,
                  url: image.url,
                  altText: image.altText,
                  fileName: image.fileName,
                  isCover: image.isCover,
                }))}
              />
            </Card>
          </div>

          <div className="stack">
            <Card title="Landlord">
              <DefinitionList
                items={[
                  {
                    term: "Name",
                    value: <Link href={`/landlords/${landlord.id}`}>{landlord.name}</Link>,
                  },
                  {
                    term: "Phone",
                    value: (
                      <span className="numeric">
                        {displayPhone(landlord.originalPhone, landlord.normalizedPhone)}
                      </span>
                    ),
                  },
                  { term: "Email", value: landlord.email ?? "-" },
                ]}
              />
            </Card>

            <Card title="Ownership">
              <DefinitionList
                items={[
                  {
                    term: "Originating fronter",
                    value: (
                      <Person name={data.fronter?.fullName} src={data.fronter?.avatarUrl} />
                    ),
                  },
                  {
                    term: "Assigned agent",
                    value: <Person name={data.agent?.fullName} src={data.agent?.avatarUrl} />,
                  },
                  {
                    term: "Added by",
                    value: <Person name={data.creator?.fullName} src={data.creator?.avatarUrl} />,
                  },
                  { term: "Created", value: formatDateTime(property.createdAt) },
                  {
                    term: "Source",
                    value: property.source.charAt(0) + property.source.slice(1).toLowerCase(),
                  },
                ]}
              />
            </Card>

            <Card title="Website">
              <DefinitionList
                items={[
                  { term: "Status", value: <StatusBadge status={property.listingStatus} /> },
                  {
                    term: "Published",
                    value: property.publishedAt ? formatDateTime(property.publishedAt) : "-",
                  },
                  { term: "Slug", value: property.slug ?? "Assigned on first publish" },
                ]}
              />
            </Card>
          </div>
        </div>
      )}

      {activeTab === "rooms" && (
        <Card title={isShared ? "Rooms" : "Room configuration"} flush>
          {!isShared ? (
            <EmptyState
              icon={<Building2 size={18} />}
              title="This is a full property"
              message="Rent and availability are managed for the property as a whole, not per room."
            />
          ) : rooms.length === 0 ? (
            <EmptyState
              icon={<Building2 size={18} />}
              title="No rooms yet"
              message="A shared property needs at least one room before it can be published."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Available from</th>
                    <th className="numeric">Rent pcm</th>
                    <th className="numeric">Rent pw</th>
                    <th className="numeric">Deposit</th>
                    <th>Commission</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td className="table-primary">{room.name}</td>
                      <td>{formatDateOnly(room.availabilityDate)}</td>
                      <td className="numeric">{formatGBP(room.rentPerMonthPence)}</td>
                      <td className="numeric">{formatGBP(room.rentPerWeekPence)}</td>
                      <td className="numeric">{formatGBP(room.depositPence)}</td>
                      <td>
                        {room.commissionValue == null
                          ? "-"
                          : room.commissionType === "PERCENTAGE"
                            ? `${room.commissionValue / 100}%`
                            : formatGBP(room.commissionValue)}
                      </td>
                      <td>
                        <StatusBadge status={room.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === "listing" && (
        <div style={{ maxWidth: 760 }}>
          <Card title="Public listing">
            <ListingEditor
              propertyId={property.id}
              initial={{
                title: property.title ?? "",
                description: property.description ?? "",
                metaTitle: property.metaTitle ?? "",
                metaDescription: property.metaDescription ?? "",
              }}
              canPublish={data.canPublish}
              readiness={readiness}
              isPublished={property.listingStatus === "PUBLISHED"}
            />
          </Card>
        </div>
      )}

      {activeTab === "pipeline" && (
        <div className="stack">
          <Card title="Deals" flush>
            {deals.length === 0 ? (
              <EmptyState
                icon={<KeyRound size={18} />}
                title="No deals yet"
                message="Starting a viewing opens a deal and begins the pipeline."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Room</th>
                      <th>Stage</th>
                      <th>Started</th>
                      <th>Last update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal) => (
                      <tr key={deal.id}>
                        <td className="table-primary">{deal.tenantName}</td>
                        <td>{deal.roomName ?? "Whole property"}</td>
                        <td>
                          <StatusBadge status={deal.stage} />
                          {deal.closeReason && (
                            <div className="table-secondary">{deal.closeReason}</div>
                          )}
                        </td>
                        <td className="table-secondary">{formatDate(deal.startedAt)}</td>
                        <td className="table-secondary">{formatDate(deal.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Viewings" flush>
            {viewings.length === 0 ? (
              <EmptyState
                icon={<KeyRound size={18} />}
                title="No viewings recorded"
                message="Every viewing attempt, successful or not, is kept here permanently."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Room</th>
                      <th>Attempt</th>
                      <th>Scheduled</th>
                      <th>Status</th>
                      <th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewings.map((viewing) => (
                      <tr key={viewing.id}>
                        <td className="table-primary">{viewing.tenantName}</td>
                        <td>{viewing.roomName ?? "Whole property"}</td>
                        <td className="numeric">{viewing.attemptNumber}</td>
                        <td>{formatDateTime(viewing.scheduledFor)}</td>
                        <td>
                          <StatusBadge status={viewing.status} />
                        </td>
                        <td className="table-secondary">{viewing.outcomeReason ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="grid-sidebar">
          <Card title="Notes">
            <NotesPanel
              entityType="PROPERTY"
              entityId={property.id}
              currentUserId={context.user.id}
              canModerate={context.isAdmin}
              revalidate={`/properties/${property.id}`}
              notes={notes.map((note) => ({
                id: note.id,
                body: note.body,
                createdAt: note.createdAt.toISOString(),
                updatedAt: note.updatedAt.toISOString(),
                authorId: note.authorId,
                authorName: note.authorName,
                authorAvatar: note.authorAvatar,
                edited: note.updatedAt.getTime() !== note.createdAt.getTime(),
              }))}
            />
          </Card>

          <Card title="Activity">
            <Timeline
              entries={activity.map((entry) => ({
                id: entry.id,
                summary: entry.summary,
                createdAt: entry.createdAt.toISOString(),
                actorName: entry.actorName,
                type: entry.type,
              }))}
            />
          </Card>
        </div>
      )}

      {activeTab === "edit" && context.isAdmin && (
        <PropertyRecordEditor
          property={{
            id: property.id,
            reference: property.reference,
            propertyType: property.propertyType,
            category: property.category,
            addressLine1: property.addressLine1,
            addressLine2: property.addressLine2,
            doorNumber: property.doorNumber,
            town: property.town,
            county: property.county,
            postcode: property.postcode,
            area: property.area,
            livingRoom: property.livingRoom,
            numberOfRooms: property.numberOfRooms,
            availableRooms: property.availableRooms,
            bathrooms: property.bathrooms,
            availabilityDate: property.availabilityDate,
            rentPerMonthPence: property.rentPerMonthPence,
            depositPence: property.depositPence,
            commissionType: property.commissionType,
            commissionValue: property.commissionValue,
            title: property.title,
            description: property.description,
            metaTitle: property.metaTitle,
            metaDescription: property.metaDescription,
            features: {
              furnished: property.furnished,
              livingLandlord: property.livingLandlord,
              garden: property.garden,
              parking: property.parking,
              billsIncluded: property.billsIncluded,
              balcony: property.balcony,
              disabledAccess: property.disabledAccess,
              wifi: property.wifi,
              couplesAllowed: property.couplesAllowed,
              petsAllowed: property.petsAllowed,
              dssAllowed: property.dssAllowed,
              childrenAllowed: property.childrenAllowed,
            },
            hasClosedSale: property.dealStage === "CLOSED_SUCCESSFUL",
          }}
        />
      )}
    </>
  );
}

function FeatureGrid({ property }: { property: Record<string, unknown> }) {
  const entries = Object.entries(FEATURE_LABELS) as [keyof PropertyFeatures, string][];

  return (
    <div className="form-grid">
      {entries.map(([key, label]) => {
        const value = property[key];
        return (
          <div key={key} className="row row--between" style={{ fontSize: "0.85rem" }}>
            <span className="muted">{label}</span>
            {value === true ? (
              <span className="badge badge--positive">Yes</span>
            ) : value === false ? (
              <span className="badge badge--neutral">No</span>
            ) : (
              <span className="subtle small">Not recorded</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
