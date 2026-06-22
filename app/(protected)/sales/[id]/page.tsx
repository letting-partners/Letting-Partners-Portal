import { notFound } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { SaleDetailPanel } from "@/components/records/sale-detail-panel";

type Props = {
  params: {
    id: string;
  };
};

export default async function SaleDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) {
    return null;
  }

  const sale = await db.sale.findFirst({
    where: {
      id: params.id,
      property: {
        ownerAgentId: session.userId,
      },
    },
    select: {
      id: true,
      finalAmount: true,
      commissionPct: true,
      commissionAmount: true,
      otherCosts: true,
      profit: true,
      closedAt: true,
      property: {
        select: {
          id: true,
          propertyRef: true,
          addressLine1: true,
          city: true,
          postcode: true,
          landlord: {
            select: {
              id: true,
              landlordName: true,
            },
          },
          ownerAgent: {
            select: {
              id: true,
              agentDisplayName: true,
              email: true,
            },
          },
        },
      },
      tenant: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          currentAddress: true,
          moveInDate: true,
          rentAmount: true,
          depositAmount: true,
          notes: true,
        },
      },
      closedBy: {
        select: {
          id: true,
          agentDisplayName: true,
          email: true,
        },
      },
    },
  });

  if (!sale) notFound();

  return (
    <SaleDetailPanel
      sale={{
        ...sale,
        finalAmount: Number(sale.finalAmount),
        commissionPct: Number(sale.commissionPct),
        commissionAmount: Number(sale.commissionAmount),
        otherCosts: sale.otherCosts === null ? null : Number(sale.otherCosts),
        profit: Number(sale.profit),
        tenant: sale.tenant
          ? {
              ...sale.tenant,
              rentAmount: sale.tenant.rentAmount === null ? null : Number(sale.tenant.rentAmount),
              depositAmount: sale.tenant.depositAmount === null ? null : Number(sale.tenant.depositAmount),
            }
          : null,
      }}
      backHref="/sales"
      backLabel="Back to Sales"
      propertyHref={`/portal/properties/${sale.property.id}`}
      tenantHref={sale.tenant ? `/tenants/${sale.tenant.id}` : null}
    />
  );
}
