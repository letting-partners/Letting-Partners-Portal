import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { AgentMessagesClient } from "./messages-client";

export const dynamic = "force-dynamic";

export default async function AgentMessagesPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.role !== UserRole.AGENT) redirect("/admin");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { agentDisplayName: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/login");

  // All other active users: other agents + admin
  const contacts = await db.user.findMany({
    where: { isActive: true, id: { not: session.userId } },
    select: { id: true, agentDisplayName: true, email: true, role: true, profilePicture: true },
    orderBy: [{ role: "asc" }, { agentDisplayName: "asc" }],
  });

  return (
    <AgentMessagesClient
      agentId={session.userId}
      contacts={contacts.map((c) => ({
        id: c.id,
        name: c.agentDisplayName,
        email: c.email,
        role: c.role as string,
        profilePicture: c.profilePicture,
      }))}
    />
  );
}
