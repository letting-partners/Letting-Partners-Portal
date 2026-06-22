import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { AdminPotentialTenantsClient } from "./admin-potential-tenants-client";

export const dynamic = "force-dynamic";

export default async function AdminPotentialTenantsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const [total, tenants] = await Promise.all([
    db.potentialTenant.count(),
    db.potentialTenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        interestedIn: true,
        budget: true,
        notes: true,
        createdAt: true,
        addedByAgent: {
          select: { id: true, agentDisplayName: true },
        },
      },
    }),
  ]);

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Potential Tenants</h1>
          <p className="page-subtitle">
            {total} potential {total !== 1 ? "tenants" : "tenant"} tracked platform-wide
          </p>
        </div>
      </header>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .683.438l1.842 3.73 4.116.598a.75.75 0 0 1 .416 1.279l-2.98 2.903.703 4.1a.75.75 0 0 1-1.088.791L10 12.775l-3.692 1.94a.75.75 0 0 1-1.088-.79l.704-4.101L2.943 7.02a.75.75 0 0 1 .416-1.28l4.116-.597L9.317 1.44A.75.75 0 0 1 10 1Z" clipRule="evenodd" />
            </svg>
            Potential Tenant Records
          </h2>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{total} total</span>
        </div>

        {tenants.length === 0 ? (
          <div className="admin-card-body">
            <p className="muted" style={{ margin: 0, textAlign: "center" }}>
              No potential tenants recorded yet. Agents can add prospects from their panel.
            </p>
          </div>
        ) : (
          <AdminPotentialTenantsClient tenants={tenants} />
        )}
      </div>
    </div>
  );
}
