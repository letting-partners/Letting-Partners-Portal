import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const [dialerDomain, me, teamAgents] = await Promise.all([
    db.dialerDomainConfig.findUnique({
      where: { id: "singleton" },
      select: {
        dialerMode: true,
        linkusWebClientUrl: true,
        domain: true,
        websocketHost: true,
        isEnabled: true,
        updatedAt: true,
      },
    }),
    db.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        email: true,
        agentDisplayName: true,
        role: true,
        isActive: true,
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
    db.user.findMany({
      where: {
        role: UserRole.AGENT,
        isActive: true,
      },
      orderBy: { agentDisplayName: "asc" },
      select: {
        id: true,
        agentDisplayName: true,
        email: true,
        dialerSetting: {
          select: {
            extensionNumber: true,
            extensionName: true,
          },
        },
      },
    }),
  ]);

  if (!me) {
    return NextResponse.json({ error: "NOT_FOUND", message: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    dialerDomain: {
      dialerMode: (dialerDomain?.dialerMode as "SIP" | "LINKUS") ?? "SIP",
      linkusWebClientUrl: dialerDomain?.linkusWebClientUrl ?? null,
      domain: dialerDomain?.domain ?? null,
      websocketHost: dialerDomain?.websocketHost ?? null,
      isEnabled: dialerDomain?.isEnabled ?? true,
      updatedAt: dialerDomain?.updatedAt ?? null,
    },
    me: {
      id: me.id,
      email: me.email,
      name: me.agentDisplayName,
      role: me.role,
      dialer: {
        extensionNumber: me.dialerSetting?.extensionNumber ?? null,
        extensionName: me.dialerSetting?.extensionName ?? null,
        providerUsername: me.dialerSetting?.providerUsername ?? null,
        providerPassword: me.dialerSetting?.providerPassword ?? null,
        autoDetectExtension: me.dialerSetting?.autoDetectExtension ?? true,
        updatedAt: me.dialerSetting?.updatedAt ?? null,
      },
    },
    intercomAgents: teamAgents
      .filter((agent) => agent.id !== me.id)
      .map((agent) => ({
        id: agent.id,
        name: agent.agentDisplayName,
        email: agent.email,
        extensionNumber: agent.dialerSetting?.extensionNumber ?? null,
        extensionName: agent.dialerSetting?.extensionName ?? null,
      })),
  });
}
