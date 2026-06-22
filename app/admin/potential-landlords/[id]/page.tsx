import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { PotentialLandlordDetailClient } from "@/components/records/potential-landlord-detail-client";

type Props = {
  params: {
    id: string;
  };
};

export default async function AdminPotentialLandlordDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });

  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  return (
    <PotentialLandlordDetailClient
      landlordId={params.id}
      backHref="/admin/potential-landlords"
      backLabel="Back to Potential Landlords"
      adminMode
    />
  );
}
