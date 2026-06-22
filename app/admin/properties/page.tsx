import { UserRole, PropertyStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getAuthSession } from "@/server/auth";
import { serializePropertyImageList } from "@/server/property-media";
import { AdminPropertiesClient } from "./admin-properties-client";

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const [total, byStatus, properties] = await Promise.all([
    db.property.count({}),
    db.property.groupBy({ by: ["status"], _count: { id: true } }),
    db.property.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        propertyRef: true,
        title: true,
        description: true,
        addressLine1: true,
        city: true,
        postcode: true,
        propertyType: true,
        beds: true,
        baths: true,
        status: true,
        vacancyType: true,
        createdAt: true,
        landlord: { select: { id: true, landlordName: true } },
        ownerAgent: { select: { id: true, agentDisplayName: true } },
        mediaLinks: {
          orderBy: [{ sortOrder: "asc" }, { mediaAssetId: "asc" }],
          select: {
            mediaAsset: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const statusMap: Partial<Record<PropertyStatus, number>> = {};
  for (const g of byStatus) statusMap[g.status] = g._count.id;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">All Properties</h1>
          <p className="page-subtitle">{total} properties (including closed)</p>
        </div>
      </header>

      {/* Status breakdown */}
      {total > 0 && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">By Status</h2>
          </div>
          <div className="admin-card-body" style={{ paddingBottom: "1.25rem" }}>
            <div className="status-breakdown">
              {(
                [
                  ["AVAILABLE", "Available", "status-item-live" ],
                  ["DRAFT",     "Draft",     "status-item-draft"],
                  ["CLOSED",    "Closed",    "status-item-sold" ],
                ] as [PropertyStatus, string, string][]
              ).map(([s, label, cls]) => (
                <div key={s} className={`status-item ${cls}`}>
                  <p className="status-item-count">{statusMap[s] ?? 0}</p>
                  <p className="status-item-label">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v11a3 3 0 1 0 6 0V4a2 2 0 0 0-2-2H4Zm1 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5-1.757 4.9-4.9a2 2 0 0 0 0-2.828L13.485 5.1a2 2 0 0 0-2.828 0L10 5.757v8.486ZM16 17H9.071l6-6H16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Z" clipRule="evenodd" />
            </svg>
            Property List
          </h2>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{total} total</span>
        </div>

        {properties.length === 0 ? (
          <div className="admin-card-body">
            <p className="muted" style={{ margin: 0, textAlign: "center" }}>No properties yet.</p>
          </div>
        ) : (
          <AdminPropertiesClient properties={serializePropertyImageList(properties)} />
        )}
      </div>
    </div>
  );
}
