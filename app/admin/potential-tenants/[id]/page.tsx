import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { PotentialTenantDetailClient } from "@/components/records/potential-tenant-detail-client";

type Props = {
  params: {
    id: string;
  };
};

export default async function AdminPotentialTenantDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });

  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  return (
    <PotentialTenantDetailClient
      tenantId={params.id}
      backHref="/admin/potential-tenants"
      backLabel="Back to Potential Tenants"
      adminMode
    />
  );
}
