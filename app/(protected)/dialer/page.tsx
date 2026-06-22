import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { DialerMainClient } from "./dialer-main-client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

type DialerPageProps = {
  searchParams?: {
    dial?: string | string[];
    autocall?: string | string[];
  };
};

export default async function DialerPage({ searchParams }: DialerPageProps) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role !== UserRole.AGENT && session.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const [dialerDomain, me, intercomAgents, contacts, recentCalls] = await Promise.all([
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
      where: { id: session.userId },
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
        id: { not: session.userId },
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
    db.dialerContact.findMany({
      where: { ownerUserId: session.userId },
      orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        extensionNumber: true,
        email: true,
        notes: true,
        isFavorite: true,
        updatedAt: true,
        labels: {
          select: {
            label: {
              select: {
                id: true,
                name: true,
                colorHex: true,
              },
            },
          },
        },
      },
    }),
    db.dialerCall.findMany({
      where: { agentUserId: session.userId },
      orderBy: [{ startedAt: "desc" }],
      take: 10,
      select: {
        id: true,
        direction: true,
        status: true,
        peerName: true,
        peerNumber: true,
        peerExtension: true,
        startedAt: true,
        endedAt: true,
        durationSec: true,
      },
    }),
  ]);

  if (!me || !me.isActive) {
    redirect("/login");
  }

  const dialQuery = Array.isArray(searchParams?.dial) ? searchParams?.dial[0] : searchParams?.dial;
  const autoCallQuery = Array.isArray(searchParams?.autocall) ? searchParams?.autocall[0] : searchParams?.autocall;
  const initialDialTarget = dialQuery?.trim() || null;
  const autoCall = autoCallQuery === "1" || autoCallQuery?.toLowerCase() === "true";

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Dialpad</h1>
          <p className="page-subtitle">
            Place calls quickly with live status, premium keypad, and instant redial.
          </p>
        </div>
      </header>

      <DialerMainClient
        bootstrap={{
          dialerDomain: {
            dialerMode: (dialerDomain?.dialerMode as "SIP" | "LINKUS") ?? "SIP",
            linkusWebClientUrl: dialerDomain?.linkusWebClientUrl ?? null,
            domain: dialerDomain?.domain ?? null,
            websocketHost: dialerDomain?.websocketHost ?? null,
            isEnabled: dialerDomain?.isEnabled ?? true,
            updatedAt: dialerDomain?.updatedAt?.toISOString() ?? null,
          },
          me: {
            id: me.id,
            email: me.email,
            name: me.agentDisplayName,
            role: me.role as "ADMIN" | "AGENT",
            dialer: {
              extensionNumber: me.dialerSetting?.extensionNumber ?? null,
              extensionName: me.dialerSetting?.extensionName ?? null,
              providerUsername: me.dialerSetting?.providerUsername ?? null,
              providerPassword: me.dialerSetting?.providerPassword ?? null,
              autoDetectExtension: me.dialerSetting?.autoDetectExtension ?? true,
              updatedAt: me.dialerSetting?.updatedAt?.toISOString() ?? null,
            },
          },
          intercomAgents: intercomAgents.map((agent) => ({
            id: agent.id,
            name: agent.agentDisplayName,
            email: agent.email,
            extensionNumber: agent.dialerSetting?.extensionNumber ?? null,
            extensionName: agent.dialerSetting?.extensionName ?? null,
          })),
        }}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          fullName: contact.fullName,
          phoneNumber: contact.phoneNumber,
          extensionNumber: contact.extensionNumber,
          email: contact.email,
          notes: contact.notes,
          isFavorite: contact.isFavorite,
          updatedAt: contact.updatedAt.toISOString(),
          labels: contact.labels.map((item) => item.label),
        }))}
        recentCalls={recentCalls.map((call) => ({
          id: call.id,
          direction: call.direction,
          status: call.status,
          peerName: call.peerName,
          peerNumber: call.peerNumber,
          peerExtension: call.peerExtension,
          startedAt: call.startedAt.toISOString(),
          endedAt: call.endedAt?.toISOString() ?? null,
          durationSec: call.durationSec,
        }))}
        initialDialTarget={initialDialTarget}
        autoCall={autoCall}
      />
    </div>
  );
}
