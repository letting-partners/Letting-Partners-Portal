import Image from "next/image";
import Link from "next/link";
import LPIcon from "@/components/LPIcon";
import { PROPERTY_FALLBACK_IMAGES } from "@/lib/images";

export type WebsiteProperty = {
  id: string | number;
  title: string;
  address?: string;
  area?: string;
  price?: number | string;
  priceLabel?: string;
  bedrooms?: number;
  bathrooms?: number;
  type?: string;
  available?: boolean;
  image?: string;
};

function getFallbackImage(id: string | number): string {
  const index = Math.abs(String(id).split("").reduce((total, char) => total + char.charCodeAt(0), 0)) % PROPERTY_FALLBACK_IMAGES.length;
  return PROPERTY_FALLBACK_IMAGES[index];
}

export default function WebsitePropertyCard({ property }: { property: WebsiteProperty }) {
  const image = property.image || getFallbackImage(property.id);
  const href = `/properties/${property.id}`;
  const priceLabel = property.priceLabel ?? "pcm";
  const numericPrice = typeof property.price === "number" ? property.price.toLocaleString("en-GB") : null;
  const textPrice = typeof property.price === "string" ? property.price : null;

  return (
    <article className="lp-property-card">
      <Link href={href} className="lp-property-card-media" aria-label={`View ${property.title}`}>
        <Image
          src={image}
          alt={property.title}
          fill
          unoptimized={image.startsWith("data:")}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="lp-cover-img"
        />
        {property.available === false && <span className="lp-property-badge">Let agreed</span>}
        {property.type && <span className="lp-property-badge lp-property-badge--type">{property.type}</span>}
      </Link>

      <div className="lp-property-card-body">
        <div className="lp-property-price">
          {numericPrice ? (
            <>
              <span>&pound;{numericPrice}</span>
              <small>/{priceLabel}</small>
            </>
          ) : (
            <span>{textPrice ?? "POA"}</span>
          )}
        </div>

        <h3>
          <Link href={href}>{property.title}</Link>
        </h3>

        {property.address && (
          <p className="lp-property-address">
            <LPIcon name="map-pin" size={16} />
            {property.address}
          </p>
        )}

        <div className="lp-property-meta">
          {property.bedrooms != null && (
            <span>
              <LPIcon name="bed" size={16} />
              {property.bedrooms} {property.bedrooms === 1 ? "bed" : "beds"}
            </span>
          )}
          {property.bathrooms != null && (
            <span>
              <LPIcon name="bath" size={16} />
              {property.bathrooms} {property.bathrooms === 1 ? "bath" : "baths"}
            </span>
          )}
          {property.area && (
            <span>
              <LPIcon name="map-pin" size={16} />
              {property.area}
            </span>
          )}
        </div>

        <Link href={href} className="lp-btn lp-btn--outline lp-btn--sm">
          View Property
        </Link>
      </div>
    </article>
  );
}
