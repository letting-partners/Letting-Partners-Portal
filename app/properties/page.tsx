import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LPIcon from "@/components/LPIcon";
import PropertiesGrid from "@/components/PropertiesGrid";
import { PAGE_BANNER_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Rental Properties in London & Birmingham | Letting Partners",
  description:
    "Browse rental properties across Ilford, Redbridge, Stratford, Barking, Walthamstow, Croydon, Hounslow, and Birmingham with Letting Partners.",
  keywords: [
    "rental properties London",
    "properties to let Ilford",
    "flats to rent East London",
    "houses to rent Birmingham",
    "letting agents London rentals",
  ],
};

export default function PropertiesPage() {
  return (
    <>
      <section className="lp-page-hero">
        <Image src={PAGE_BANNER_IMAGES.properties} alt="Rental property interior" fill priority sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">Available to Rent</span>
          <h1>Rental properties across London and Birmingham.</h1>
          <p>Browse current listings or register your requirements for matching property alerts.</p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <PropertiesGrid showSearch />
        </div>
      </section>

      <section className="lp-section lp-section--cta">
        <div className="lp-container">
          <div className="lp-cta-band" data-lp-animate>
            <div>
              <span className="lp-kicker lp-kicker--light">Tenant matching</span>
              <h2>Can&apos;t find what you&apos;re looking for?</h2>
              <p>Register your requirements and we will alert you when a suitable property becomes available.</p>
            </div>
            <div className="lp-cta-actions">
              <Link href="/tenant-services/register-as-tenant" className="lp-btn lp-btn--gold">
                Register as a Tenant
                <LPIcon name="arrow-right" size={18} />
              </Link>
              <Link href="/contact" className="lp-btn lp-btn--glass">Contact Us</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
