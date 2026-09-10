import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CalendarClock,
  Contact,
  Handshake,
  KeyRound,
  PhoneCall,
  Trophy,
  UsersRound,
} from "lucide-react";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime, formatRelative, followUpTimeState } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { displayPhone } from "@/lib/phone";
import { ROLE_LABELS } from "@/lib/navigation";
import {
  getDashboardMetrics,
  getDueFollowUps,
  getPipelineDeals,
  getRecentCalls,
  getRecentSales,
} from "@/services/dashboard";
import { getAccessContext } from "@/services/permissions";
import { StartCallButton } from "@/components/calls/StartCall";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const context = await getAccessContext();
  if (!context) redirect("/login");

  const [metrics, dueFollowUps, recentCalls, pipeline, recentSales] = await Promise.all([
    getDashboardMetrics(context),
    getDueFollowUps(context),
    getRecentCalls(context),
    getPipelineDeals(context),
    getRecentSales(context),
  ]);

  const callDelta =
    metrics.callsYesterday > 0
      ? Math.round(((metrics.callsToday - metrics.callsYesterday) / metrics.callsYesterday) * 100)
      : null;

  const firstName = context.user.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={`${ROLE_LABELS[context.user.role]} overview for ${new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}`}
        actions={
          <StartCallButton />
        }
      />

      <div className="stack--lg stack">
        <section className="stat-grid">
          <StatCard
            label="Calls today"
            value={metrics.callsToday}
            icon={<PhoneCall size={13} />}
            delta={callDelta === null ? null : { value: callDelta }}
            meta={callDelta === null ? "No calls yesterday" : "vs yesterday"}
            href="/calls"
          />
          <StatCard
            label="Interested today"
            value={metrics.interestedToday}
            icon={<Contact size={13} />}
            meta="Converted to landlord onboarding"
          />
          <StatCard
            label="Follow ups due"
            value={metrics.followUpsDue}
            icon={<CalendarClock size={13} />}
            meta={
              metrics.followUpsOverdue > 0
                ? `${metrics.followUpsOverdue} overdue`
                : "Nothing overdue"
            }
            href="/follow-ups"
          />
          <StatCard
            label="Landlords"
            value={metrics.landlords}
            icon={<Contact size={13} />}
            href="/landlords"
          />
          <StatCard
            label="Properties"
            value={metrics.properties}
            icon={<Building2 size={13} />}
            meta={`${metrics.publishedProperties} published`}
            href="/properties"
          />
          {!context.isFronter && (
            <StatCard
              label="Tenants"
              value={metrics.tenants}
              icon={<UsersRound size={13} />}
              href="/tenants"
            />
          )}
          <StatCard
            label="In pipeline"
            value={metrics.activeViewings + metrics.activeVerifications + metrics.activeClosings}
            icon={<KeyRound size={13} />}
            meta={`${metrics.activeViewings} viewing · ${metrics.activeVerifications} verification · ${metrics.activeClosings} closing`}
          />
          <StatCard
            label="Closed sales"
            value={metrics.closedSales}
            icon={<Trophy size={13} />}
            href="/sales"
          />
          <StatCard
            label="My commission"
            value={formatGBP(metrics.myCommissionPence)}
            icon={<Handshake size={13} />}
            meta="Total earned to date"
            href="/sales"
          />
        </section>

        <div className="grid-sidebar">
          <div className="stack">
            <Card
              title="Follow ups due"
              flush
              actions={
                <Link href="/follow-ups" className="btn btn--ghost btn--sm">
                  View all
                </Link>
              }
            >
              {dueFollowUps.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock size={18} />}
                  title="No follow-ups due"
                  message="Numbers you schedule for later will appear here when they come due."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Due</th>
                        <th>Priority</th>
                        <th>Last note</th>
                        <th className="table-actions">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dueFollowUps.map((item) => {
                        const timeState = followUpTimeState(item.dueAt);
                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="table-primary">
                                {item.contactName ?? "Unknown contact"}
                              </div>
                              <div className="table-secondary numeric">
                                {displayPhone(item.originalPhone, item.normalizedPhone)}
                              </div>
                            </td>
                            <td>
                              <StatusBadge status={timeState} />
                              <div className="table-secondary">{formatDateTime(item.dueAt)}</div>
                            </td>
                            <td>
                              <StatusBadge status={item.priority} />
                            </td>
                            <td className="truncate" style={{ maxWidth: 240 }}>
                              {item.notes}
                            </td>
                            <td className="table-actions">
                              <StartCallButton
                                phone={item.normalizedPhone}
                                className="btn btn--secondary btn--sm"
                              >
                                Call
                              </StartCallButton>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card
              title="Deals in progress"
              flush
              actions={
                <Link href="/viewings" className="btn btn--ghost btn--sm">
                  View pipeline
                </Link>
              }
            >
              {pipeline.length === 0 ? (
                <EmptyState
                  icon={<KeyRound size={18} />}
                  title="Nothing in the pipeline"
                  message={
                    context.isFronter
                      ? "When an agent starts a viewing on a property you added, it will show here."
                      : "Start a viewing from a property to open a deal."
                  }
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Stage</th>
                        <th>Last update</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipeline.map((deal) => (
                        <tr key={deal.id}>
                          <td>
                            <Link href={`/properties/${deal.propertyId}`} className="table-primary">
                              {deal.propertyTitle ?? deal.propertyAddress}
                            </Link>
                            <div className="table-secondary">{deal.propertyReference}</div>
                          </td>
                          <td>
                            <StatusBadge status={deal.stage} />
                          </td>
                          <td className="table-secondary">{formatRelative(deal.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="stack">
            <Card title="Recent calls" flush>
              {recentCalls.length === 0 ? (
                <EmptyState
                  icon={<PhoneCall size={18} />}
                  title="No calls yet"
                  message="Look a number up to start your first call."
                  action={
                    <StartCallButton className="btn btn--primary btn--sm" />
                  }
                />
              ) : (
                <ul>
                  {recentCalls.map((call) => (
                    <li
                      key={call.id}
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div className="row row--between">
                        <span className="numeric" style={{ fontWeight: 600 }}>
                          {displayPhone(call.originalPhone, call.normalizedPhone)}
                        </span>
                        {call.outcome ? (
                          <StatusBadge status={call.outcome} />
                        ) : (
                          <StatusBadge status={call.status} />
                        )}
                      </div>
                      <div className="table-secondary">{formatRelative(call.startedAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Recent sales" flush>
              {recentSales.length === 0 ? (
                <EmptyState
                  icon={<Trophy size={18} />}
                  title="No closed sales yet"
                  message="Completed deals and their commission appear here."
                />
              ) : (
                <ul>
                  {recentSales.map((sale) => (
                    <li
                      key={sale.id}
                      style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}
                    >
                      <Link href={`/sales/${sale.id}`} className="row row--between">
                        <span className="truncate" style={{ fontWeight: 600 }}>
                          {sale.propertyAddress}
                        </span>
                        <span className="numeric">{formatGBP(sale.grossCommissionPence)}</span>
                      </Link>
                      <div className="table-secondary">
                        {sale.reference} · {formatRelative(sale.closingDate)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
