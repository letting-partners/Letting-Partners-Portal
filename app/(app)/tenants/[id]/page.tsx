import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound, Repeat2 } from "lucide-react";
import { Card, DefinitionList, EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { NotesPanel } from "@/components/ui/NotesPanel";
import { Timeline } from "@/components/ui/Timeline";
import { formatDate, formatDateOnly, formatDateTime } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { displayPhone, toE164 } from "@/lib/phone";
import { getTenant } from "@/services/tenants";
import { listActivity, listNotes } from "@/services/notes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const context = await pageAgentOrAdmin();
  const data = await getTenant(id, context).catch(() => null);
  return { title: data?.tenant.name ?? "Tenant" };
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await pageAgentOrAdmin();

  const data = await getTenant(id, context);
  if (!data) notFound();

  const { tenant } = data;

  const [notes, activity] = await Promise.all([
    listNotes("TENANT", id),
    listActivity("Tenant", id),
  ]);

  return (
    <>
      <PageHeader
        title={tenant.name}
        subtitle={
          <span className="numeric">
            {displayPhone(tenant.originalPhone, tenant.normalizedPhone)}
          </span>
        }
        breadcrumbs={[{ label: "Tenants", href: "/tenants" }, { label: tenant.name }]}
        actions={
          <>
            <a href={`tel:${toE164(tenant.normalizedPhone)}`} className="btn btn--ghost">
              Call
            </a>
            <Link href="/cross-sell" className="btn btn--secondary">
              <Repeat2 size={15} />
              Find a property
            </Link>
          </>
        }
      />

      <div className="grid-sidebar">
        <div className="stack">
          <Card title="Deals" flush>
            {data.deals.length === 0 ? (
              <EmptyState
                icon={<KeyRound size={18} />}
                title="No deals yet"
                message="Book a viewing from a property, or search Cross sell for something that fits."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Room</th>
                      <th>Stage</th>
                      <th>Started</th>
                      <th>Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deals.map((deal) => (
                      <tr key={deal.id}>
                        <td>
                          <Link href={`/properties/${deal.propertyId}`} className="table-primary">
                            {deal.propertyTitle ?? deal.propertyAddress}
                          </Link>
                          <div className="table-secondary">{deal.propertyReference}</div>
                        </td>
                        <td>{deal.roomName ?? "Whole property"}</td>
                        <td>
                          <StatusBadge status={deal.stage} />
                        </td>
                        <td className="table-secondary">{formatDate(deal.startedAt)}</td>
                        <td className="table-secondary">
                          {deal.closedAt ? formatDate(deal.closedAt) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Notes">
            <NotesPanel
              entityType="TENANT"
              entityId={tenant.id}
              currentUserId={context.user.id}
              canModerate={context.isAdmin}
              revalidate={`/tenants/${tenant.id}`}
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
          <Card title="Requirements">
            <DefinitionList
              items={[
                { term: "Status", value: <StatusBadge status={tenant.status} /> },
                { term: "Area", value: tenant.area ?? "-" },
                { term: "Postcodes", value: tenant.postcodePreferences ?? "-" },
                {
                  term: "Budget",
                  value:
                    tenant.minBudgetPence || tenant.maxBudgetPence
                      ? `${formatGBP(tenant.minBudgetPence)} to ${formatGBP(tenant.maxBudgetPence)} pcm`
                      : "-",
                },
                { term: "Move in", value: formatDateOnly(tenant.moveInDate) },
                { term: "Bedrooms", value: tenant.bedrooms ?? "-" },
                {
                  term: "Property type",
                  value: tenant.propertyTypePreference
                    ? tenant.propertyTypePreference.replace(/_/g, " ").toLowerCase()
                    : "No preference",
                },
                { term: "Requirements", value: tenant.requirements ?? "-" },
              ]}
            />
          </Card>

          <Card title="Contact">
            <DefinitionList
              items={[
                {
                  term: "Phone",
                  value: (
                    <span className="numeric">
                      {displayPhone(tenant.originalPhone, tenant.normalizedPhone)}
                    </span>
                  ),
                },
                { term: "Email", value: tenant.email ?? "-" },
                {
                  term: "Owner agent",
                  value: (
                    <Person name={data.ownerAgent?.fullName} src={data.ownerAgent?.avatarUrl} />
                  ),
                },
                { term: "Registered", value: formatDateTime(tenant.createdAt) },
                {
                  term: "Source",
                  value: tenant.source.charAt(0) + tenant.source.slice(1).toLowerCase(),
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
