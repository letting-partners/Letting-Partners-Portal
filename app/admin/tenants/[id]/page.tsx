import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { TenantDetailClient } from "@/components/records/tenant-detail-client";

type Props = {
  params: {
    id: string;
  };
};

export default async function AdminTenantDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });

  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  return (
    <TenantDetailClient
      tenantId={params.id}
      backHref="/admin/tenants"
      backLabel="Back to Tenants"
      adminMode
    />
  );
}
