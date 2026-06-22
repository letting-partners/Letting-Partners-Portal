import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import LPIcon from "@/components/LPIcon";
import { PROPERTY_FALLBACK_IMAGES } from "@/lib/images";
import { getPublicWebsiteProperty } from "@/lib/website-properties";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const property = await getPublicWebsiteProperty(params.id);
  return {
    title: property ? `${property.title} | Letting Partners` : "Property Details | Letting Partners",
    description: property?.description ?? "View Letting Partners rental property details.",
  };
}

export default async function PropertyDetailPage({ params }: Props) {
  const property = await getPublicWebsiteProperty(params.id);
  if (!property) notFound();

  const fallbackImage = PROPERTY_FALLBACK_IMAGES[Math.abs(params.id.charCodeAt(0)) % PROPERTY_FALLBACK_IMAGES.length];
  const image = property.image || fallbackImage;
  const price = typeof property.price === "number" ? `£${property.price.toLocaleString("en-GB")}` : property.price ?? "POA";

  return (
    <>
      <section className="lp-page-hero">
        <Image src={image} alt={property.title} fill priority unoptimized={image.startsWith("data:")} sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">{property.type ?? "Rental Property"}</span>
          <h1>{property.title}</h1>
          <p>{property.address ?? property.area ?? "Available through Letting Partners"}</p>
          <div className="lp-hero-actions">
            <Link href="/contact" className="lp-btn lp-btn--gold">Enquire Now</Link>
            <Link href="/properties" className="lp-btn lp-btn--glass">Browse Properties</Link>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-split lp-split--intro">
            <div>
              <span className="lp-kicker">Property Details</span>
              <h2>{price}{typeof property.price === "number" ? `/${property.priceLabel ?? "pcm"}` : ""}</h2>
              {property.description ? <p>{property.description}</p> : <p>Contact Letting Partners for full details and viewing availability.</p>}
            </div>
            <div className="lp-card">
              <h3>At a glance</h3>
              <div className="lp-property-meta" style={{ marginTop: "1rem" }}>
                {property.bedrooms != null && <span><LPIcon name="bed" size={16} /> {property.bedrooms} beds</span>}
                {property.bathrooms != null && <span><LPIcon name="bath" size={16} /> {property.bathrooms} baths</span>}
                {property.area && <span><LPIcon name="map-pin" size={16} /> {property.area}</span>}
              </div>
              <ul className="lp-check-list">
                {property.deposit != null && <li><LPIcon name="check" size={17} /> Deposit: £{property.deposit.toLocaleString("en-GB")}</li>}
                {property.availableFrom && <li><LPIcon name="check" size={17} /> Available from {new Date(property.availableFrom).toLocaleDateString("en-GB")}</li>}
                {property.features.map((feature) => <li key={feature}><LPIcon name="check" size={17} /> {feature}</li>)}
              </ul>
              <div className="lp-inline-actions">
                <Link href="/contact" className="lp-btn lp-btn--navy">Request a Viewing</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
