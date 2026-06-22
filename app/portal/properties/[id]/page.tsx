import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function yesNo(value: boolean | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value ? "Yes" : "No";
}

function money(value: unknown, prefix = "GBP ") {
  if (value === null || value === undefined) return "-";
  const num = Number(String(value));
  if (Number.isNaN(num)) return "-";
  return `${prefix}${num.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type Props = { params: { id: string } };

export default async function PropertyDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const property = await db.property.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      propertyRef: true,
      title: true,
      description: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      county: true,
      postcode: true,
      propertyType: true,
      beds: true,
      baths: true,
      status: true,
      vacancyType: true,
      landlordDemand: true,
      expectedCommissionPct: true,
      expectedCommissionAmt: true,
      totalRooms: true,
      availableRooms: true,
      rentPerMonth: true,
      depositAmount: true,
      isFurnished: true,
      personsAllowed: true,
      petsAllowed: true,
      dssAllowed: true,
      childrenAllowed: true,
      availabilityDate: true,
      livingLandlord: true,
      createdAt: true,
      updatedAt: true,
      ownerAgentId: true,
      landlord: {
        select: {
          id: true,
          landlordName: true,
          landlordNumber: true,
          phoneLast10: true,
          email: true,
          ownerAgentId: true,
        },
      },
      ownerAgent: {
        select: { id: true, agentDisplayName: true },
      },
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
      rooms: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          roomName: true,
          landlordDemand: true,
          expectedCommissionPct: true,
          status: true,
          sale: {
            select: {
              id: true,
              finalAmount: true,
              commissionAmount: true,
              profit: true,
              closedAt: true,
              tenant: { select: { id: true, fullName: true, phone: true } },
            },
          },
        },
      },
      sales: {
        orderBy: { closedAt: "desc" },
        select: {
          id: true,
          finalAmount: true,
          commissionPct: true,
          commissionAmount: true,
          otherCosts: true,
          profit: true,
          closedAt: true,
          tenant: {
            select: {
              fullName: true,
              email: true,
              phone: true,
              currentAddress: true,
              moveInDate: true,
              rentAmount: true,
              depositAmount: true,
              notes: true,
            },
          },
        },
      },
    },
  });

  if (!property) notFound();

  if (session.role !== "ADMIN" && property.ownerAgentId !== session.userId) {
    redirect("/portal/properties");
  }

  const fullAddress = [
    property.addressLine1,
    property.addressLine2,
    property.city,
    property.county,
    property.postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const propertyImages = property.mediaLinks.map((link) => link.mediaAsset);
  const featuredImage = propertyImages[0] ?? null;
  const galleryImages = propertyImages.slice(1);

  const statusBadge: Record<string, string> = {
    AVAILABLE: "badge-active",
    DRAFT: "badge-draft",
    CLOSED: "badge-sold",
  };
  const statusLabel: Record<string, string> = {
    AVAILABLE: "Available",
    DRAFT: "Draft",
    CLOSED: "Closed",
  };

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">{property.title || property.propertyRef}</h1>
          <p className="page-subtitle">
            {[property.propertyRef, fullAddress || "No address recorded"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="inline-row">
          <Link className="btn btn-secondary" href={`/landlords/${property.landlord.id}/properties`}>
            Back to Properties
          </Link>
          <Link className="btn btn-secondary" href="/portal/properties">
            All Properties
          </Link>
          <Link className="btn btn-secondary" href={`/portal/properties/${property.id}/edit`}>
            Edit Property
          </Link>
        </div>
      </header>

      <div className="inline-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <span className={`badge ${statusBadge[property.status] ?? "badge-draft"}`}>
          {statusLabel[property.status] ?? property.status}
        </span>
        <span className={`badge ${property.vacancyType === "MULTIPLE" ? "badge-offer" : "badge-active"}`}>
          {property.vacancyType === "MULTIPLE" ? "Shared" : "Private"}
        </span>
      </div>

      <div className="panel">
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
            Landlord Details
          </h2>
        </div>
        <div style={{ padding: "1.25rem" }}>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Full Name</span>
              <Link href={`/landlords/${property.landlord.id}`} style={{ color: "var(--brand-gold)", fontWeight: 600 }}>
                {property.landlord.landlordName}
              </Link>
            </div>
            <div className="detail-item">
              <span className="detail-label">Phone Number</span>
              <span className="detail-value">{property.landlord.landlordNumber || property.landlord.phoneLast10}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Email Address</span>
              <span className="detail-value">{property.landlord.email ?? "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Managing Agent</span>
              <span className="detail-value">{property.ownerAgent.agentDisplayName}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
            Property Information
          </h2>
        </div>
        <div style={{ padding: "1.25rem" }}>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Property Reference</span>
              <span className="detail-value"><code>{property.propertyRef}</code></span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Property Title</span>
              <span className="detail-value">{property.title ?? "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Full Address</span>
              <span className="detail-value">{fullAddress || "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Property Type</span>
              <span className="detail-value">{property.propertyType ?? "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Property Category</span>
              <span className="detail-value">{property.vacancyType === "MULTIPLE" ? "Shared" : "Private"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Beds / Baths</span>
              <span className="detail-value">
                {property.beds != null ? property.beds : "-"} beds / {property.baths != null ? property.baths : "-"} baths
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Total Number of Rooms</span>
              <span className="detail-value">{property.totalRooms ?? "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Available Rooms</span>
              <span className="detail-value">{property.availableRooms ?? "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Rent per Month</span>
              <span className="detail-value">{money(property.rentPerMonth)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Deposit Amount</span>
              <span className="detail-value">{money(property.depositAmount)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Property Furnished</span>
              <span className="detail-value">{yesNo(property.isFurnished)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Number of Persons Allowed</span>
              <span className="detail-value">{property.personsAllowed ?? "-"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Pets Allowed</span>
              <span className="detail-value">{yesNo(property.petsAllowed)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">DSS Allowed</span>
              <span className="detail-value">{yesNo(property.dssAllowed)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Children Allowed</span>
              <span className="detail-value">{yesNo(property.childrenAllowed)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Property Availability Date</span>
              <span className="detail-value">
                {property.availabilityDate ? formatDate(property.availabilityDate) : "-"}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Living Landlord</span>
              <span className="detail-value">{yesNo(property.livingLandlord)}</span>
            </div>
            <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
              <span className="detail-label">Property Description</span>
              <span className="detail-value" style={{ whiteSpace: "pre-wrap" }}>
                {property.description ?? "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {featuredImage ? (
        <div className="panel">
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
              Property Images
            </h2>
          </div>
          <div className="property-detail-gallery" style={{ padding: "1.25rem" }}>
            <figure className="property-detail-hero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media-library/${featuredImage.id}/image`} alt={featuredImage.name} />
              <figcaption>{featuredImage.name}</figcaption>
            </figure>

            {galleryImages.length > 0 ? (
              <div className="property-detail-grid">
                {galleryImages.map((image) => (
                  <figure key={image.id} className="property-detail-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/media-library/${image.id}/image`} alt={image.name} />
                    <figcaption>{image.name}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
            Financial
          </h2>
        </div>
        <div style={{ padding: "1.25rem" }}>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Landlord Demand</span>
              <span className="detail-value">{money(property.landlordDemand)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Expected Commission</span>
              <span className="detail-value">
                {property.expectedCommissionAmt != null
                  ? money(property.expectedCommissionAmt)
                  : property.expectedCommissionPct != null
                    ? `${property.expectedCommissionPct}%`
                    : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {property.vacancyType === "MULTIPLE" && property.rooms.length > 0 && (
        <div className="panel">
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>Rooms</h2>
          </div>
          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Demand</th>
                  <th>Commission</th>
                  <th>Tenant</th>
                  <th>Sale Amount</th>
                </tr>
              </thead>
              <tbody>
                {property.rooms.map((room) => (
                  <tr key={room.id}>
                    <td>{room.roomName}</td>
                    <td>
                      <span className={`badge ${room.status === "AVAILABLE" ? "badge-active" : room.status === "CLOSED" ? "badge-sold" : "badge-offer"}`}>
                        {room.status}
                      </span>
                    </td>
                    <td>{money(room.landlordDemand)}</td>
                    <td>{room.expectedCommissionPct != null ? `${room.expectedCommissionPct}%` : "-"}</td>
                    <td>{room.sale?.tenant?.fullName ?? "-"}</td>
                    <td>{room.sale ? money(room.sale.finalAmount) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {property.sales.length > 0 && (
        <div className="panel">
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
              Sale History
            </h2>
          </div>
          {property.sales.map((sale) => (
            <div key={sale.id} style={{ padding: "1.25rem", borderBottom: "1px solid var(--border)" }}>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Final Amount</span>
                  <span className="detail-value" style={{ color: "#4ade80", fontWeight: 700 }}>
                    {money(sale.finalAmount)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Commission</span>
                  <span className="detail-value">{String(sale.commissionPct)}% -&gt; {money(sale.commissionAmount)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Other Costs</span>
                  <span className="detail-value">{money(sale.otherCosts)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Profit</span>
                  <span className="detail-value">{money(sale.profit)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Closed At</span>
                  <span className="detail-value">{formatDate(sale.closedAt)}</span>
                </div>
                {sale.tenant && (
                  <>
                    <div className="detail-item">
                      <span className="detail-label">Tenant</span>
                      <span className="detail-value">{sale.tenant.fullName}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Tenant Email</span>
                      <span className="detail-value">{sale.tenant.email ?? "-"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Tenant Phone</span>
                      <span className="detail-value">{sale.tenant.phone ?? "-"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Move-In Date</span>
                      <span className="detail-value">
                        {sale.tenant.moveInDate ? formatDate(sale.tenant.moveInDate) : "-"}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Monthly Rent</span>
                      <span className="detail-value">{money(sale.tenant.rentAmount)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Deposit</span>
                      <span className="detail-value">{money(sale.tenant.depositAmount)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Current Address</span>
                      <span className="detail-value">{sale.tenant.currentAddress ?? "-"}</span>
                    </div>
                    {sale.tenant.notes && (
                      <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                        <span className="detail-label">Notes</span>
                        <span className="detail-value">{sale.tenant.notes}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", paddingBottom: "2rem" }}>
        Added {formatDate(property.createdAt)} · Last updated {formatDate(property.updatedAt)}
      </div>
    </div>
  );
}
