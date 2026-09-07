import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import { Activity } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Person } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { getPerformance, resolveReportRange } from "@/services/reports";
import RangePicker from "../RangePicker";

export const metadata: Metadata = { title: "Performance" };

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAgentOrAdmin();
  const params = await searchParams;

  const range = resolveReportRange(params.range, params.from, params.to);
  const rows = await getPerformance(context, range);

  // Best conversion first, so the strongest and weakest are both obvious.
  const ranked = [...rows].sort((a, b) => b.conversionRate - a.conversionRate);

  return (
    <>
      <PageHeader
        title="Performance"
        subtitle={
          <>
            {range.label} · {formatDate(range.from)} to {formatDate(range.to)}
          </>
        }
        actions={<RangePicker />}
      />

      <div className="card">
        {ranked.length === 0 ? (
          <EmptyState
            icon={<Activity size={18} />}
            title="Nothing to report yet"
            message="Once your team starts calling, their figures will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th className="numeric">Calls</th>
                  <th className="numeric">Interested</th>
                  <th className="numeric">Not interested</th>
                  <th className="numeric">Follow ups</th>
                  <th className="numeric">Landlords</th>
                  <th className="numeric">Properties</th>
                  <th className="numeric">Sales</th>
                  <th className="numeric">Conversion</th>
                  <th className="numeric">Commission</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => (
                  <tr key={row.userId}>
                    <td>
                      <Person name={row.fullName} src={row.avatarUrl} />
                    </td>
                    <td>
                      <StatusBadge status={row.role} />
                    </td>
                    <td className="numeric">{row.calls}</td>
                    <td className="numeric">{row.interested}</td>
                    <td className="numeric">{row.notInterested}</td>
                    <td className="numeric">{row.followUps}</td>
                    <td className="numeric">{row.landlordsAdded}</td>
                    <td className="numeric">{row.propertiesAdded}</td>
                    <td className="numeric">{row.closedSales}</td>
                    <td className="numeric">
                      <strong>{row.conversionRate}%</strong>
                    </td>
                    <td className="numeric">{formatGBP(row.commissionPence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
