import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  Contact,
  Globe,
  KeyRound,
  PhoneCall,
  PhoneOff,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui/layout";
import { formatDate } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { getCallTrend, getDailyReport, getFunnel, resolveReportRange } from "@/services/reports";
import RangePicker from "../RangePicker";

export const metadata: Metadata = { title: "Daily report" };

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAccess();
  const params = await searchParams;

  const range = resolveReportRange(params.range, params.from, params.to);

  const [report, funnel, trend] = await Promise.all([
    getDailyReport(context, range),
    getFunnel(context, range),
    getCallTrend(context, 14),
  ]);

  const funnelMax = Math.max(...funnel.map((step) => step.value), 1);
  const trendMax = Math.max(...trend.map((point) => point.total), 1);

  return (
    <>
      <PageHeader
        title="Daily report"
        subtitle={
          <>
            {range.label} · {formatDate(range.from)}
            {range.from.toDateString() !== range.to.toDateString() && ` to ${formatDate(range.to)}`}
          </>
        }
        actions={<RangePicker />}
      />

      <div className="stack--lg stack">
        <section className="stat-grid">
          <StatCard label="Total calls" value={report.totalCalls} icon={<PhoneCall size={13} />} />
          <StatCard
            label="Interested"
            value={report.interested}
            icon={<ThumbsUp size={13} />}
            meta={`${report.conversionRate}% conversion`}
          />
          <StatCard
            label="Not interested"
            value={report.notInterested}
            icon={<PhoneOff size={13} />}
          />
          <StatCard
            label="Follow ups created"
            value={report.followUpsCreated}
            icon={<CalendarClock size={13} />}
          />
          <StatCard
            label="Landlords added"
            value={report.landlordsAdded}
            icon={<Contact size={13} />}
          />
          <StatCard
            label="Properties added"
            value={report.propertiesAdded}
            icon={<Building2 size={13} />}
          />
          <StatCard
            label="Published to web"
            value={report.propertiesPublished}
            icon={<Globe size={13} />}
          />
          <StatCard
            label="Viewings created"
            value={report.viewingsCreated}
            icon={<KeyRound size={13} />}
          />
          <StatCard
            label="Successful sales"
            value={report.successfulSales}
            icon={<Trophy size={13} />}
          />
          {context.isAdmin && (
            <StatCard
              label="Gross commission"
              value={formatGBP(report.grossCommissionPence)}
              meta="On sales closed in this range"
            />
          )}
          <StatCard
            label="My commission"
            value={formatGBP(report.myCommissionPence)}
            meta="Earned in this range"
          />
        </section>

        <div className="grid-2">
          <Card title="Conversion funnel">
            <div className="funnel">
              {funnel.map((step) => (
                <div className="funnel-row" key={step.label}>
                  <span className="muted">{step.label}</span>
                  <div className="funnel-track">
                    <div
                      className="funnel-fill"
                      style={{ width: `${Math.round((step.value / funnelMax) * 100)}%` }}
                    />
                  </div>
                  <span className="numeric" style={{ textAlign: "right" }}>
                    {step.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="subtle small" style={{ marginTop: 12 }}>
              Each step counts activity inside the selected range, so a sale closed today from a
              call last week appears at the sale step only.
            </p>
          </Card>

          <Card title="Calls, last 14 days">
            <div className="bar-chart">
              {trend.map((point) => (
                <div className="bar-chart-col" key={point.day}>
                  <div
                    className="bar-chart-bar"
                    style={{ height: `${Math.round((point.total / trendMax) * 100)}%` }}
                    title={`${point.total} call${point.total === 1 ? "" : "s"} on ${point.day}`}
                  />
                  <span className="bar-chart-label">{point.day.slice(8)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {!context.isFronter && (
          <Card
            title="Team performance"
            actions={
              <Link href="/reports/performance" className="btn btn--ghost btn--sm">
                Full breakdown
              </Link>
            }
          >
            <p className="muted small">
              Per-person calls, conversion, properties and commission for this range.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
