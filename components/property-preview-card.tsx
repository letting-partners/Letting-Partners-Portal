import Link from "next/link";
import type { ReactNode } from "react";

type PropertyImage = {
  id: string;
  name?: string | null;
  dataUrl?: string;
  imageUrl?: string;
};

type PropertyPreviewData = {
  propertyRef: string;
  title?: string | null;
  description?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
  propertyType?: string | null;
  beds?: number | null;
  baths?: number | null;
  status?: string | null;
  vacancyType?: string | null;
  images?: PropertyImage[] | null;
};

type LinkedLabel = {
  name: string;
  href?: string;
  label: string;
};

type Props = {
  href: string;
  property: PropertyPreviewData;
  landlord?: LinkedLabel;
  agent?: LinkedLabel;
  extra?: ReactNode;
  footer?: ReactNode;
};

function statusBadgeClass(status: string | null | undefined) {
  if (status === "AVAILABLE") return "badge-active";
  if (status === "CLOSED") return "badge-sold";
  return "badge-draft";
}

function statusLabel(status: string | null | undefined) {
  if (status === "AVAILABLE") return "Available";
  if (status === "CLOSED") return "Closed";
  if (status === "DRAFT") return "Draft";
  return status ?? null;
}

function vacancyLabel(vacancyType: string | null | undefined) {
  if (vacancyType === "MULTIPLE") return "Shared";
  if (vacancyType === "SINGLE") return "Private";
  return null;
}

function countLabel(value: number | null | undefined, singular: string, plural = `${singular}s`) {
  if (value == null) return null;
  return `${value} ${value === 1 ? singular : plural}`;
}

function renderLinkedLabel(item: LinkedLabel) {
  return item.href ? (
    <Link href={item.href} className="property-preview-link">
      {item.name}
    </Link>
  ) : (
    <span>{item.name}</span>
  );
}

export function PropertyPreviewCard({ href, property, landlord, agent, extra, footer }: Props) {
  const title = property.title?.trim() || property.addressLine1?.trim() || property.propertyRef;
  const location = [property.addressLine1, property.city, property.postcode].filter(Boolean).join(", ");
  const previewImage = property.images?.[0] ?? null;
  const description = property.description?.trim();
  const specs = [
    property.propertyType,
    countLabel(property.beds, "bed"),
    countLabel(property.baths, "bath"),
  ].filter(Boolean);
  const normalizedStatus = statusLabel(property.status);
  const vacancy = vacancyLabel(property.vacancyType);

  return (
    <article className="property-preview-card">
      <Link href={href} className="property-preview-media" aria-label={`Open ${title}`}>
        {previewImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewImage.imageUrl ?? previewImage.dataUrl} alt={previewImage.name || title} />
        ) : (
          <div className="property-preview-placeholder">
            <span>No featured image</span>
          </div>
        )}

        {(normalizedStatus || vacancy) ? (
          <div className="property-preview-media-overlay">
            <div className="property-preview-pills">
              {normalizedStatus ? (
                <span className={`badge ${statusBadgeClass(property.status)}`}>{normalizedStatus}</span>
              ) : null}
              {vacancy ? (
                <span className={`badge ${property.vacancyType === "MULTIPLE" ? "badge-offer" : "badge-active"}`}>
                  {vacancy}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </Link>

      <div className="property-preview-content">
        <div className="stack" style={{ gap: "0.35rem" }}>
          <Link href={href} className="property-preview-title">
            {title}
          </Link>
          <div className="property-preview-subtitle">{location || property.propertyRef}</div>
        </div>

        {description ? <p className="property-preview-description">{description}</p> : null}

        <div className="property-preview-meta">
          <span className="property-preview-meta-chip">
            <code>{property.propertyRef}</code>
          </span>
          {specs.map((value) => (
            <span key={value} className="property-preview-meta-chip">
              {value}
            </span>
          ))}
        </div>

        {landlord || agent ? (
          <div className="property-preview-links">
            {landlord ? (
              <span>
                {landlord.label}: {renderLinkedLabel(landlord)}
              </span>
            ) : null}
            {agent ? (
              <span>
                {agent.label}: {renderLinkedLabel(agent)}
              </span>
            ) : null}
          </div>
        ) : null}

        {extra ? <div className="property-preview-extra">{extra}</div> : null}
        {footer ? <div className="property-preview-footer">{footer}</div> : null}
      </div>
    </article>
  );
}
