import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { LandlordPropertiesClient } from "./properties-client";

type Props = {
  params: {
    id: string;
  };
};

export default async function LandlordPropertiesPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) {
    return null;
  }

  if (session.role !== "ADMIN") {
    const landlord = await db.landlord.findUnique({
      where: { id: params.id },
      select: { id: true, ownerAgentId: true },
    });

    if (!landlord) {
      redirect("/landlords");
    }

    if (landlord.ownerAgentId !== session.userId) {
      redirect(`/landlords/${params.id}`);
    }
  }

  return <LandlordPropertiesClient landlordId={params.id} currentRole={session.role} />;
}
