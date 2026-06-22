import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminDialerDomainClient } from "./dialer-domain-client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function AdminDialerDomainPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/admin/login");
  }

  const [user, config] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: {
        role: true,
        isActive: true,
      },
    }),
    db.dialerDomainConfig.findUnique({
      where: { id: "singleton" },
      select: {
        id: true,
        dialerMode: true,
        linkusWebClientUrl: true,
        pbxPlatform: true,
        domain: true,
        sipPort: true,
        sipTransport: true,
        websocketHost: true,
        isEnabled: true,
        updatedAt: true,
        updatedBy: {
          select: {
            id: true,
            agentDisplayName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  if (!user || !user.isActive) {
    redirect("/admin/login");
  }

  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <AdminDialerDomainClient
      initialConfig={
        config
          ? {
              id: config.id,
              dialerMode: config.dialerMode as "SIP" | "LINKUS",
              linkusWebClientUrl: config.linkusWebClientUrl,
              pbxPlatform: config.pbxPlatform,
              domain: config.domain,
              sipPort: config.sipPort,
              sipTransport: config.sipTransport,
              websocketHost: config.websocketHost,
              isEnabled: config.isEnabled,
              updatedAt: config.updatedAt.toISOString(),
              updatedBy: config.updatedBy,
            }
          : {
              id: "singleton",
              dialerMode: "SIP",
              linkusWebClientUrl: null,
              pbxPlatform: null,
              domain: null,
              sipPort: null,
              sipTransport: null,
              websocketHost: null,
              isEnabled: true,
              updatedAt: null,
              updatedBy: null,
            }
      }
    />
  );
}
