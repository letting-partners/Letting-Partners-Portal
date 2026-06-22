import { UserRole } from "@prisma/client";
import { AuthActivityTracker } from "@/components/auth-activity-tracker";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { AdminShell } from "./admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getAuthSession();
  if (!session) {
    return <>{children}</>;
  }

  const [user, agents] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, isActive: true, agentDisplayName: true, profilePicture: true },
    }),
    db.user.findMany({
      where: { role: UserRole.AGENT, isActive: true },
      select: { id: true, agentDisplayName: true, email: true, profilePicture: true },
      orderBy: { agentDisplayName: "asc" },
    }),
  ]);

  if (!user || !user.isActive || user.role !== UserRole.ADMIN) {
    return <>{children}</>;
  }

  return (
    <AdminShell
      user={{ name: user.agentDisplayName, email: session.email, profilePicture: user.profilePicture }}
      userId={session.userId}
      chatContacts={agents.map((a) => ({ id: a.id, name: a.agentDisplayName, email: a.email, profilePicture: a.profilePicture }))}
    >
      <AuthActivityTracker />
      {children}
    </AdminShell>
  );
}
