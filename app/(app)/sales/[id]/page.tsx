import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, DefinitionList, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { CommissionBreakdownView } from "@/components/ui/CommissionBreakdown";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatGBP, formatPKR } from "@/lib/money";
import { getSale } from "@/services/sales";
import { listDealStageHistory } from "@/services/deals";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const context = await pageAccess();
  const data = await getSale(id, context).catch(() => null);
  return { title: data?.sale.reference ?? "Sale" };
}

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await pageAccess();

  const data = await getSale(id, context);
  if (!data) notFound();

  const { sale, property, landlord, tenant, breakdown } = data;
  const history = await listDealStageHistory(sale.dealId);

  return (
    <>
      <PageHeader
        title={sale.reference}
        subtitle={
          <>
            Closed {formatDate(sale.closingDate)} · {property.formattedAddress}
            {data.roomName ? ` · ${data.roomName}` : ""}
          </>
        }
        breadcrumbs={[{ label: "Sales", href: "/sales" }, { label: sale.reference }]}
        actions={
          <Link href={`/properties/${property.id}`} className="btn btn--secondary">
            View property
          </Link>
        }
      />

      <div className="grid-sidebar">
        <div className="stack">
          <Card title="Commission breakdown">
            <CommissionBreakdownView
              breakdown={breakdown}
              showCompany={data.showCompanyFigures}
            />
          </Card>

          <Card title="Who earned what" flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Beneficiary</th>
                    <th>Role</th>
                    <th>Rule applied</th>
                    <th className="numeric">Calculated from</th>
                    <th className="numeric">Amount</th>
                    <th className="numeric">Approx. PKR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.commissions.map((commission) => (
                    <tr key={commission.id}>
                      <td className="table-primary">
                        {commission.beneficiaryName}
                        {commission.isMine && (
                          <span className="badge badge--accent" style={{ marginLeft: 6 }}>
                            You
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={commission.beneficiary} />
                      </td>
                      <td className="table-secondary">
                        {commission.ruleType === "PERCENTAGE" && commission.ruleValue != null
                          ? `${commission.ruleValue / 100}%`
                          : commission.ruleType === "FIXED" && commission.ruleValue != null
                            ? `Fixed ${formatGBP(commission.ruleValue)}`
                            : "Remainder"}
                      </td>
                      <td className="numeric">{formatGBP(commission.basisPence)}</td>
                      <td className="numeric">
                        <strong>{formatGBP(commission.amountPence, { precise: true })}</strong>
                      </td>
                      <td className="numeric table-secondary">
                        {commission.pkrAmount != null ? formatPKR(commission.pkrAmount) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Deal history">
            <ol className="timeline">
              {history.map((entry) => (
                <li key={entry.id} className="timeline-item">
                  <div className="timeline-time">{formatDateTime(entry.changedAt)}</div>
                  <div className="timeline-summary">
                    {entry.fromStage ? `${entry.fromStage} → ` : ""}
                    <strong>{entry.toStage}</strong>
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </div>
                  {entry.notes && <div className="subtle small">{entry.notes}</div>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="stack">
          <Card title="Sale">
            <DefinitionList
              items={[
                { term: "Reference", value: sale.reference },
                { term: "Status", value: <StatusBadge status={sale.status} /> },
                { term: "Closed", value: formatDateTime(sale.closingDate) },
                {
                  term: "Type",
                  value: sale.collaborationId ? "Cross-sell collaboration" : "Single agent",
                },
                {
                  term: "Recorded by",
                  value: <Person name={data.creator?.fullName} src={data.creator?.avatarUrl} />,
                },
              ]}
            />
          </Card>

          <Card title="Parties">
            <DefinitionList
              items={[
                {
                  term: "Landlord",
                  value: <Link href={`/landlords/${landlord.id}`}>{landlord.name}</Link>,
                },
                { term: "Tenant", value: tenant.name },
                {
                  term: "Property agent",
                  value: (
                    <Person
                      name={data.propertyAgent?.fullName}
                      src={data.propertyAgent?.avatarUrl}
                    />
                  ),
                },
                ...(data.tenantAgent
                  ? [
                      {
                        term: "Tenant agent",
                        value: (
                          <Person
                            name={data.tenantAgent.fullName}
                            src={data.tenantAgent.avatarUrl}
                          />
                        ),
                      },
                    ]
                  : []),
                {
                  term: "Originating fronter",
                  value: <Person name={data.fronter?.fullName} src={data.fronter?.avatarUrl} />,
                },
              ]}
            />
          </Card>

          <Card title="Property">
            <DefinitionList
              items={[
                {
                  term: "Property",
                  value: (
                    <Link href={`/properties/${property.id}`}>
                      {property.title ?? property.formattedAddress}
                    </Link>
                  ),
                },
                { term: "Reference", value: property.reference },
                ...(data.roomName ? [{ term: "Room", value: data.roomName }] : []),
                { term: "Postcode", value: property.postcode },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
