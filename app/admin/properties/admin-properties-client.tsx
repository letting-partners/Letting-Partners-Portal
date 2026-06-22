"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";
import { PropertyPreviewCard } from "@/components/property-preview-card";
import { PropertyStatusDropdown } from "@/components/property-status-dropdown";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDate } from "@/lib/format";
import type { PropertyStatus } from "@/lib/portal-api";

type PropertyRow = {
  id: string;
  propertyRef: string;
  title: string | null;
  description: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  status: PropertyStatus;
  vacancyType: "SINGLE" | "MULTIPLE";
  createdAt: Date;
  images?: Array<{ id: string; name: string; imageUrl?: string; dataUrl?: string }>;
  landlord: { id: string; landlordName: string };
  ownerAgent: { id: string; agentDisplayName: string | null } | null;
};

type Props = {
  properties: PropertyRow[];
};

export function AdminPropertiesClient({ properties: initial }: Props) {
  const [properties, setProperties] = useState(initial);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredProperties = properties.filter((property) => {
    const haystack = [
      property.propertyRef,
      property.title,
      property.description,
      property.addressLine1,
      property.city,
      property.postcode,
      property.propertyType,
      property.landlord.landlordName,
      property.ownerAgent?.agentDisplayName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.trim().toLowerCase());
  });

  const totalPages = filteredProperties.length === 0 ? 0 : Math.ceil(filteredProperties.length / pageSize);
  const visibleProperties = filteredProperties.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="stack">
      <div style={{ padding: "0 1.25rem 1rem" }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="label">Search</span>
          <UIInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Title, address, ref, landlord, agent, postcode"
          />
        </label>
      </div>

      <div style={{ padding: "0 1.25rem" }}>
        {visibleProperties.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No properties match your search.
          </p>
        ) : (
          <div className="property-card-grid">
            {visibleProperties.map((prop) => (
              <PropertyPreviewCard
                key={prop.id}
                href={`/admin/properties/${prop.id}`}
                property={prop}
                landlord={{
                  label: "Landlord",
                  name: prop.landlord.landlordName,
                  href: `/landlords/${prop.landlord.id}`,
                }}
                agent={prop.ownerAgent ? {
                  label: "Agent",
                  name: prop.ownerAgent.agentDisplayName ?? "—",
                  href: `/admin/agents/${prop.ownerAgent.id}`,
                } : undefined}
                footer={(
                  <div className="property-preview-footer-stack">
                    <div className="property-card-footer-note">
                      Added {formatDate(prop.createdAt)}
                    </div>
                    <div className="property-card-action-row">
                      <PropertyStatusDropdown
                        propertyId={prop.id}
                        status={prop.status}
                        onUpdated={(newStatus) => {
                          setProperties((prev) =>
                            prev.map((item) =>
                              item.id === prop.id ? { ...item, status: newStatus as PropertyStatus } : item,
                            ),
                          );
                        }}
                      />
                      <Link
                        href={`/admin/properties/${prop.id}/edit`}
                        className="btn btn-secondary property-card-action-btn"
                      >
                        Edit
                      </Link>
                      <AdminDeleteButton
                        label="Delete"
                        confirmMessage={`Permanently delete "${prop.title || prop.addressLine1 || prop.propertyRef}"? This will also delete all associated rooms, sales, and tenant records. This cannot be undone.`}
                        deleteUrl={`/api/properties/${prop.id}`}
                      />
                    </div>
                  </div>
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "0 1.25rem 1.25rem" }}>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={filteredProperties.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
