import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AgentsAdminClient } from "../agents-admin-client";
import { db } from "@/server/db";
import { getAuthSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/admin/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    redirect("/admin/login");
  }

  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const agents = await db.user.findMany({
    where: { role: UserRole.AGENT },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      email: true,
      agentDisplayName: true,
      profilePicture: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          ownedLandlords: true,
          ownedProperties: true,
        },
      },
      ownedProperties: {
        where: { sales: { some: {} } },
        select: {
          sales: {
            take: 1,
            select: {
              tenant: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  return (
    <AgentsAdminClient
      initialAgents={agents.map((agent) => ({
        id: agent.id,
        email: agent.email,
        agentDisplayName: agent.agentDisplayName,
        profilePicture: agent.profilePicture,
        isActive: agent.isActive,
        createdAt: agent.createdAt.toISOString(),
        ownedLandlords: agent._count.ownedLandlords,
        ownedProperties: agent._count.ownedProperties,
        closedSales: agent.ownedProperties.length,
        tenants: agent.ownedProperties.filter((p) => p.sales[0]?.tenant != null).length,
      }))}
    />
  );
}
