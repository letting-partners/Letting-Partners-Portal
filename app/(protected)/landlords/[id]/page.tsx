import { getAuthSession } from "@/server/auth";
import { LandlordDetailClient } from "./page-client";

type Props = {
  params: {
    id: string;
  };
};

export default async function LandlordDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) {
    return null;
  }

  return <LandlordDetailClient landlordId={params.id} currentRole={session.role} />;
}
