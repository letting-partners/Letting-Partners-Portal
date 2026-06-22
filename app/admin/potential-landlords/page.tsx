import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { AdminPotentialLandlordsClient } from "./admin-potential-landlords-client";

export const dynamic = "force-dynamic";

export default async function AdminPotentialLandlordsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const [total, landlords] = await Promise.all([
    db.potentialLandlord.count(),
    db.potentialLandlord.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        phoneLast10: true,
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
          <h1 className="page-title">Potential Landlords</h1>
          <p className="page-subtitle">
            {total} potential {total !== 1 ? "landlords" : "landlord"} tracked platform-wide
          </p>
        </div>
      </header>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            Potential Landlord Records
          </h2>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{total} total</span>
        </div>

        {landlords.length === 0 ? (
          <div className="admin-card-body">
            <p className="muted" style={{ margin: 0, textAlign: "center" }}>
              No potential landlords recorded yet. Agents can add prospects from their panel.
            </p>
          </div>
        ) : (
          <AdminPotentialLandlordsClient landlords={landlords} />
        )}
      </div>
    </div>
  );
}
