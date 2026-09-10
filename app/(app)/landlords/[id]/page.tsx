import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, PhoneCall, Plus } from "lucide-react";
import { Card, DefinitionList, EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { NotesPanel } from "@/components/ui/NotesPanel";
import { Timeline } from "@/components/ui/Timeline";
import { formatDate, formatDateTime, followUpTimeState } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { displayPhone, toE164 } from "@/lib/phone";
import { getLandlord } from "@/services/landlords";
import { listActivity, listNotes } from "@/services/notes";
import { loadPeopleMap } from "@/services/landlords";
import { StartCallButton } from "@/components/calls/StartCall";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const context = await pageAccess();
  const data = await getLandlord(id, context).catch(() => null);
  return { title: data?.landlord.name ?? "Landlord" };
}

export default async function LandlordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await pageAccess();

  const data = await getLandlord(id, context);
  if (!data) notFound();

  const { landlord } = data;

  const [notes, activity, callers] = await Promise.all([
    listNotes("LANDLORD", id),
    listActivity("Landlord", id),
    loadPeopleMap(data.calls.map((call) => call.calledById)),
  ]);

  return (
    <>
      <PageHeader
        title={landlord.name}
        subtitle={
          <span className="numeric">
            {displayPhone(landlord.originalPhone, landlord.normalizedPhone)}
          </span>
        }
        breadcrumbs={[{ label: "Landlords", href: "/landlords" }, { label: landlord.name }]}
        actions={
          <>
            <a href={`tel:${toE164(landlord.normalizedPhone)}`} className="btn btn--ghost">
              <PhoneCall size={15} />
              Call
            </a>
            <StartCallButton phone={landlord.normalizedPhone} className="btn btn--secondary">
              Log a call
            </StartCallButton>
            <Link href={`/properties/new?landlordId=${landlord.id}`} className="btn btn--primary">
              <Plus size={15} />
              Add property
            </Link>
          </>
        }
      />

      <div className="grid-sidebar">
        <div className="stack">
          <Card
            title="Properties"
            flush
            actions={
              <Link href={`/properties/new?landlordId=${landlord.id}`} className="btn btn--ghost btn--sm">
                Add property
              </Link>
            }
          >
            {data.properties.length === 0 ? (
              <EmptyState
                icon={<Building2 size={18} />}
                title="No properties yet"
                message="Add the first property for this landlord to start marketing it."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Type</th>
                      <th className="numeric">Rent</th>
                      <th>Website</th>
                      <th>Deal stage</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.properties.map((property) => (
                      <tr key={property.id}>
                        <td>
                          <Link href={`/properties/${property.id}`} className="table-primary">
                            {property.title ?? property.formattedAddress}
                          </Link>
                          <div className="table-secondary">
                            {property.reference} · {property.postcode}
                          </div>
                        </td>
                        <td>{property.propertyType === "SHARED" ? "Shared" : "Full"}</td>
                        <td className="numeric">{formatGBP(property.rentPerMonthPence)}</td>
                        <td>
                          <StatusBadge status={property.listingStatus} />
                        </td>
                        <td>
                          <StatusBadge status={property.dealStage} />
                        </td>
                        <td className="table-secondary">{formatDate(property.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Call history" flush>
            {data.calls.length === 0 ? (
              <EmptyState
                icon={<PhoneCall size={18} />}
                title="No calls recorded"
                message="Every call to this number is kept, including attempts made before the landlord was created."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="numeric">Attempt</th>
                      <th>Started</th>
                      <th>Called by</th>
                      <th>Outcome</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.calls.map((call) => (
                      <tr key={call.id}>
                        <td className="numeric">{call.attemptNumber}</td>
                        <td>{formatDateTime(call.startedAt)}</td>
                        <td>
                          <Person name={callers.get(call.calledById)?.fullName} />
                        </td>
                        <td>
                          <StatusBadge status={call.outcome ?? call.status} />
                        </td>
                        <td className="table-secondary truncate" style={{ maxWidth: 280 }}>
                          {call.notes ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {data.followUps.length > 0 && (
            <Card title="Follow ups" flush>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Due</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.followUps.map((followUp) => (
                      <tr key={followUp.id}>
                        <td>
                          {formatDateTime(followUp.dueAt)}
                          {followUp.status === "SCHEDULED" && (
                            <div style={{ marginTop: 3 }}>
                              <StatusBadge status={followUpTimeState(followUp.dueAt)} />
                            </div>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={followUp.priority} />
                        </td>
                        <td>
                          <StatusBadge status={followUp.status} />
                        </td>
                        <td className="table-secondary truncate" style={{ maxWidth: 280 }}>
                          {followUp.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title="Notes">
            <NotesPanel
              entityType="LANDLORD"
              entityId={landlord.id}
              currentUserId={context.user.id}
              canModerate={context.isAdmin}
              revalidate={`/landlords/${landlord.id}`}
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
        </div>

        <div className="stack">
          <Card title="Details">
            <DefinitionList
              items={[
                { term: "Name", value: landlord.name },
                {
                  term: "Phone",
                  value: (
                    <span className="numeric">
                      {displayPhone(landlord.originalPhone, landlord.normalizedPhone)}
                    </span>
                  ),
                },
                { term: "Alternate phone", value: landlord.alternatePhone ?? "-" },
                { term: "Email", value: landlord.email ?? "-" },
                {
                  term: "Gender",
                  value: landlord.gender.replace(/_/g, " ").toLowerCase(),
                },
                {
                  term: "Source",
                  value: landlord.source.charAt(0) + landlord.source.slice(1).toLowerCase(),
                },
              ]}
            />
            {context.isAdmin && (
              <p className="subtle small" style={{ marginTop: 12 }}>
                The phone number is this landlord&apos;s identity key. Corrections are an
                administrator action and are recorded in the audit log.
              </p>
            )}
          </Card>

          <Card title="Ownership">
            <DefinitionList
              items={[
                {
                  term: "Originating fronter",
                  value: <Person name={data.fronter?.fullName} src={data.fronter?.avatarUrl} />,
                },
                {
                  term: "Assigned agent",
                  value: <Person name={data.agent?.fullName} src={data.agent?.avatarUrl} />,
                },
                {
                  term: "Added by",
                  value: <Person name={data.creator?.fullName} src={data.creator?.avatarUrl} />,
                },
                { term: "Created", value: formatDateTime(landlord.createdAt) },
                {
                  term: "Last contact",
                  value: landlord.lastContactAt ? formatDateTime(landlord.lastContactAt) : "-",
                },
              ]}
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
      </div>
    </>
  );
}
