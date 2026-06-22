import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function DialerIntercallingPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role !== UserRole.AGENT && session.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const agents = await db.user.findMany({
    where: {
      role: UserRole.AGENT,
      isActive: true,
      id: { not: session.userId },
    },
    orderBy: [{ agentDisplayName: "asc" }],
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
  });

  const agentsWithExtension = agents.filter((agent) => Boolean(agent.dialerSetting?.extensionNumber));

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Intercalling</h1>
          <p className="page-subtitle">
            Call internal agents directly using extension-based intercom.
          </p>
        </div>
      </header>

      <section className="dialer-card">
        <div className="dialer-card-head">
          <h2 className="dialer-card-title">Agent Extensions</h2>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {agentsWithExtension.length}/{agents.length} ready
          </span>
        </div>
        {agents.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No active agents found.
          </p>
        ) : (
          <div className="dialer-agent-list">
            {agents.map((agent) => {
              const extension = agent.dialerSetting?.extensionNumber ?? null;
              const dialHref = extension
                ? `/dialer?dial=${encodeURIComponent(extension)}&autocall=1`
                : null;
              return (
                <article key={agent.id} className="dialer-agent-item">
                  <div>
                    <p className="dialer-agent-name">{agent.agentDisplayName}</p>
                    <p className="dialer-agent-meta">
                      {extension ? `Ext ${extension}` : "No extension configured"} | {agent.email}
                    </p>
                    {agent.dialerSetting?.extensionName ? (
                      <p className="dialer-agent-meta" style={{ marginTop: "0.05rem" }}>
                        Alias: {agent.dialerSetting.extensionName}
                      </p>
                    ) : null}
                  </div>
                  {dialHref ? (
                    <Link className="btn btn-primary btn-sm" href={dialHref}>
                      Call
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-secondary btn-sm" disabled>
                      Unavailable
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
