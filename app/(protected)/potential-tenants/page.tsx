import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { PotentialTenantsClient } from "./potential-tenants-client";

export const dynamic = "force-dynamic";

export default async function PotentialTenantsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/login");
  if (user.role === UserRole.ADMIN) redirect("/admin/potential-tenants");

  const tenants = await (db as any).potentialTenant.findMany({
    where: { addedByAgentId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      interestedIn: true,
      budget: true,
      accommodationType: true,
      maximumBudget: true,
      moveInDate: true,
      notes: true,
      createdAt: true,
      addedByAgent: {
        select: { id: true, agentDisplayName: true },
      },
    },
  });

  const serialized = tenants.map((t: any) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    moveInDate: t.moveInDate ? t.moveInDate.toISOString() : null,
  }));

  return <PotentialTenantsClient initialTenants={serialized} />;
}
