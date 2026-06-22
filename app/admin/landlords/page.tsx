import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getAuthSession } from "@/server/auth";
import { formatDate } from "@/lib/format";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";

export const dynamic = "force-dynamic";

export default async function AdminLandlordsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const [total, landlords] = await Promise.all([
    db.landlord.count(),
    db.landlord.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        landlordName: true,
        landlordNumber: true,
        email: true,
        phoneE164: true,
        createdAt: true,
        ownerAgent: { select: { id: true, agentDisplayName: true, email: true } },
        _count: { select: { properties: true } },
      },
    }),
  ]);

  const active = landlords.filter((l) => l._count.properties > 0).length;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">All Landlords</h1>
          <p className="page-subtitle">
            {total} landlord{total !== 1 ? "s" : ""} platform-wide · {active} active
          </p>
        </div>
      </header>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
            </svg>
            Landlord Management
          </h2>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{total} total</span>
        </div>

        {landlords.length === 0 ? (
          <div className="admin-card-body">
            <p className="muted" style={{ margin: 0, textAlign: "center" }}>No landlords yet.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Number</th>
                  <th>Contact</th>
                  <th>Agent</th>
                  <th>Properties</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {landlords.map((landlord) => (
                  <tr key={landlord.id}>
                    <td>
                      <strong style={{ color: "var(--text)" }}>{landlord.landlordName}</strong>
                    </td>
                    <td>
                      <code style={{ fontSize: "0.8rem" }}>{landlord.landlordNumber}</code>
                    </td>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {landlord.email && <span style={{ display: "block" }}>{landlord.email}</span>}
                      {landlord.phoneE164 && <span>{landlord.phoneE164}</span>}
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      <Link
                        href={`/admin/agents/${landlord.ownerAgent.id}`}
                        style={{ color: "var(--brand-gold)" }}
                      >
                        {landlord.ownerAgent.agentDisplayName}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--brand-gold)" }}>
                      {landlord._count.properties}
                    </td>
                    <td>
                      <span className={`badge ${landlord._count.properties > 0 ? "badge-active" : "badge-passive"}`}>
                        {landlord._count.properties > 0 ? "Active" : "Passive"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {formatDate(landlord.createdAt)}
                    </td>
                    <td>
                      <div className="inline-row">
                        <Link
                          href={`/landlords/${landlord.id}`}
                          className="btn btn-secondary"
                          style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                        >
                          Edit
                        </Link>
                        <AdminDeleteButton
                          label="Delete"
                          confirmMessage={`Permanently delete landlord "${landlord.landlordName}"? This will also delete all their properties, sales, and tenant records. This cannot be undone.`}
                          deleteUrl={`/api/landlords/${landlord.id}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
