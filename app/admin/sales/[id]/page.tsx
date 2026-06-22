import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { SaleDetailPanel } from "@/components/records/sale-detail-panel";

type Props = {
  params: {
    id: string;
  };
};

export default async function AdminSaleDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });

  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const sale = await db.sale.findUnique({
    where: { id: params.id },
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
      backHref="/admin/sales"
      backLabel="Back to Sales"
      propertyHref={`/admin/properties/${sale.property.id}`}
      tenantHref={sale.tenant ? `/admin/tenants/${sale.tenant.id}` : null}
      adminMode
    />
  );
}
