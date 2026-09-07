import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { ClearFilters, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDate } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { listSales } from "@/services/sales";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAccess();
  const params = await searchParams;

  const result = await listSales(context, {
    search: params.q,
    page: params.page ? Number(params.page) : 1,
  });

  const myTotal = result.rows.reduce((total, row) => total + row.myCommissionPence, 0);

  return (
    <>
      <PageHeader
        title="Sales"
        subtitle="Closed deals with their commission frozen at the moment they completed."
      />

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="Sales" value={result.total} icon={<Trophy size={13} />} />
        {context.isAdmin && (
          <>
            <StatCard
              label="Gross commission"
              value={formatGBP(result.totals.grossPence)}
              meta="Across the filtered sales"
            />
            <StatCard
              label="Company retained"
              value={formatGBP(result.totals.companyPence)}
              meta="After staff commission"
            />
          </>
        )}
        <StatCard
          label="My commission"
          value={formatGBP(myTotal)}
          meta="On the sales shown"
        />
      </div>

      <div className="card">
        <div className="filter-bar">
          <SearchInput placeholder="Search reference, property, tenant or landlord..." />
          <ClearFilters keys={["q"]} />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<Trophy size={18} />}
            title="No closed sales yet"
            message="A sale is created automatically when a deal closes, along with the commission for everyone involved."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sale</th>
                  <th>Property</th>
                  <th>Landlord</th>
                  <th>Tenant</th>
                  <th>Fronter</th>
                  <th>Agents</th>
                  {context.isAdmin && <th className="numeric">Gross</th>}
                  <th className="numeric">My commission</th>
                  {context.isAdmin && <th className="numeric">Company net</th>}
                  <th>Closed</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/sales/${row.id}`} className="table-primary">
                        {row.reference}
                      </Link>
                      {row.collaborationId && (
                        <div>
                          <StatusBadge status="ACCEPTED" label="Cross sell" />
                        </div>
                      )}
                    </td>

                    <td>
                      <Link href={`/properties/${row.propertyId}`}>
                        {row.propertyTitle ?? row.propertyAddress}
                      </Link>
                      <div className="table-secondary">
                        {row.propertyReference}
                        {row.roomName ? ` · ${row.roomName}` : ""}
                      </div>
                    </td>

                    <td>
                      <Link href={`/landlords/${row.landlordId}`}>{row.landlordName}</Link>
                    </td>

                    <td>{row.tenantName}</td>

                    <td>
                      <Person name={row.fronter?.fullName} src={row.fronter?.avatarUrl} />
                    </td>

                    <td>
                      <Person
                        name={row.propertyAgent?.fullName}
                        src={row.propertyAgent?.avatarUrl}
                        meta="Property"
                      />
                      {row.tenantAgent && (
                        <div style={{ marginTop: 4 }}>
                          <Person
                            name={row.tenantAgent.fullName}
                            src={row.tenantAgent.avatarUrl}
                            meta="Tenant"
                          />
                        </div>
                      )}
                    </td>

                    {context.isAdmin && (
                      <td className="numeric">{formatGBP(row.grossCommissionPence)}</td>
                    )}

                    <td className="numeric">
                      {row.myCommissionPence > 0 ? (
                        <strong>{formatGBP(row.myCommissionPence, { precise: true })}</strong>
                      ) : (
                        <span className="subtle">-</span>
                      )}
                    </td>

                    {context.isAdmin && (
                      <td className="numeric">{formatGBP(row.companyNetPence)}</td>
                    )}

                    <td className="table-secondary">{formatDate(row.closingDate)}</td>
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
