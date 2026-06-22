import { getAuthSession } from "@/server/auth";
import { PotentialLandlordDetailClient } from "@/components/records/potential-landlord-detail-client";

type Props = {
  params: {
    id: string;
  };
};

export default async function PotentialLandlordDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) {
    return null;
  }

  return (
    <PotentialLandlordDetailClient
      landlordId={params.id}
      backHref="/potential-landlords"
      backLabel="Back to Potential Landlords"
    />
  );
}
