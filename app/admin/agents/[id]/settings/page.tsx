import { UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { AdminAgentSettingsClient } from "./settings-client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
};

export default async function AdminAgentSettingsPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/admin/login");
  }

  const [user, agent, dialerConfig] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: {
        role: true,
        isActive: true,
      },
    }),
    db.user.findFirst({
      where: { id: params.id, role: UserRole.AGENT },
      select: {
        id: true,
        email: true,
        agentDisplayName: true,
        isActive: true,
        createdAt: true,
        dialerSetting: {
          select: {
            extensionNumber: true,
            extensionName: true,
            providerUsername: true,
            providerPassword: true,
            autoDetectExtension: true,
            updatedAt: true,
          },
        },
      },
    }),
    db.dialerDomainConfig.findUnique({
      where: { id: "singleton" },
      select: {
        dialerMode: true,
      },
    }),
  ]);

  if (!user || !user.isActive) {
    redirect("/admin/login");
  }

  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  if (!agent) {
    notFound();
  }

  return (
    <AdminAgentSettingsClient
      dialerMode={(dialerConfig?.dialerMode as "SIP" | "LINKUS") ?? "SIP"}
      initialAgent={{
        id: agent.id,
        email: agent.email,
        agentDisplayName: agent.agentDisplayName,
        isActive: agent.isActive,
        createdAt: agent.createdAt.toISOString(),
        dialer: {
          extensionNumber: agent.dialerSetting?.extensionNumber ?? null,
          extensionName: agent.dialerSetting?.extensionName ?? null,
          providerUsername: agent.dialerSetting?.providerUsername ?? null,
          autoDetectExtension: agent.dialerSetting?.autoDetectExtension ?? true,
          hasProviderPassword: Boolean(agent.dialerSetting?.providerPassword),
          updatedAt: agent.dialerSetting?.updatedAt?.toISOString() ?? null,
        },
      }}
    />
  );
}
