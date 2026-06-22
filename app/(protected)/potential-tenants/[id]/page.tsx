import { getAuthSession } from "@/server/auth";
import { PotentialTenantDetailClient } from "@/components/records/potential-tenant-detail-client";

type Props = {
  params: {
    id: string;
  };
};

export default async function PotentialTenantDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) {
    return null;
  }

  return (
    <PotentialTenantDetailClient
      tenantId={params.id}
      backHref="/potential-tenants"
      backLabel="Back to Potential Tenants"
    />
  );
}
