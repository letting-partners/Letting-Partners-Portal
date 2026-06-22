import { getAuthSession } from "@/server/auth";
import { TenantDetailClient } from "@/components/records/tenant-detail-client";

type Props = {
  params: {
    id: string;
  };
};

export default async function TenantDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) {
    return null;
  }

  return (
    <TenantDetailClient
      tenantId={params.id}
      backHref="/tenants"
      backLabel="Back to Tenants"
    />
  );
}
