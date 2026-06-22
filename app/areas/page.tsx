import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LPIcon from "@/components/LPIcon";
import { AREAS, getAreaHref } from "@/lib/areas";
import { AREA_IMAGES, PAGE_BANNER_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Areas We Cover | Letting Partners",
  description:
    "Letting Partners covers Ilford, Redbridge, Stratford, Barking, Walthamstow, Croydon, Hounslow, and Birmingham with letting and property management services.",
  keywords: ["letting agents Ilford", "property management East London", "letting agents Birmingham", "London rental areas"],
};

export default function AreasPage() {
  return (
    <>
      <section className="lp-page-hero">
        <Image src={PAGE_BANNER_IMAGES.areas} alt="London residential street and skyline" fill priority sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">Coverage Areas</span>
          <h1>Letting and property management across London and Birmingham.</h1>
          <p>Explore local rental market highlights, transport links, property types, and services available in each area.</p>
        </div>
      </section>

      <section className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Our Areas</span>
            <h2>Choose your local market.</h2>
            <p>Each area page includes tenant highlights, landlord opportunities, services available, and local FAQs.</p>
          </div>
          <div className="lp-area-grid" data-lp-animate>
            {AREAS.map((area) => (
              <Link key={area.slug} href={getAreaHref(area.slug)} className="lp-area-card">
                <Image src={AREA_IMAGES[area.slug] ?? area.image} alt={`${area.title} property area`} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw" className="lp-cover-img" />
                <div className="lp-area-overlay" />
                <div>
                  <span>{area.coverageLabel}</span>
                  <h3>{area.title}</h3>
                  <p>{area.description}</p>
                  <small>Explore area <LPIcon name="arrow-right" size={15} /></small>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cta">
        <div className="lp-container">
          <div className="lp-cta-band" data-lp-animate>
            <div>
              <span className="lp-kicker lp-kicker--light">Need another area?</span>
              <h2>Tell us where your property or search is based.</h2>
              <p>We may still be able to help or advise on the most practical next step.</p>
            </div>
            <div className="lp-cta-actions">
              <Link href="/contact" className="lp-btn lp-btn--gold">Speak to Letting Partners</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
