import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { AdminChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function AdminChatPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const agents = await db.user.findMany({
    where: { role: UserRole.AGENT, isActive: true },
    select: { id: true, agentDisplayName: true, email: true, profilePicture: true },
    orderBy: { agentDisplayName: "asc" },
  });

  return (
    <AdminChatClient
      adminId={session.userId}
      agents={agents.map((a) => ({
        id: a.id,
        name: a.agentDisplayName,
        email: a.email,
        profilePicture: a.profilePicture,
      }))}
    />
  );
}
