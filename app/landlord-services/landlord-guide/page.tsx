import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LPIcon, { type LPIconName } from "@/components/LPIcon";
import { PAGE_BANNER_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Landlord Guide | Letting Partners",
  description:
    "The Letting Partners landlord guide covers ASTs, deposit protection, safety certificates, Right to Rent, repairs, and notices in England.",
  keywords: ["landlord guide UK", "landlord obligations England", "AST guide landlord", "deposit protection landlord UK"],
};

const guideSections: Array<{ icon: LPIconName; title: string; content: string }> = [
  { icon: "file", title: "Assured Shorthold Tenancies", content: "Most private residential lettings are governed by Assured Shorthold Tenancies. The AST should set out rent, term, deposit details, obligations, and the possession process clearly." },
  { icon: "shield", title: "Deposit Protection", content: "Deposits for assured shorthold tenants must be protected in a government-approved scheme within 30 days, with prescribed information served correctly." },
  { icon: "wrench", title: "Repair Obligations", content: "Landlords must maintain the structure, exterior, heating, hot water, and electrical and gas installations in proper working order." },
  { icon: "file-check", title: "Safety Certificates", content: "Gas safety, EICR, EPC, smoke alarms, and carbon monoxide requirements must be handled before and during a tenancy where applicable." },
  { icon: "clipboard", title: "Right to Rent", content: "Right to Rent checks must confirm all adult occupants have the legal right to rent residential property in England." },
  { icon: "scale", title: "Possession and Notices", content: "Section 21 and Section 8 notices have strict requirements around timing, form, service, and supporting documents." },
];

export default function LandlordGuidePage() {
  return (
    <>
      <section className="lp-page-hero">
        <Image src={PAGE_BANNER_IMAGES.landlordGuide} alt="Landlord property paperwork" fill priority sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">For Landlords</span>
          <h1>The Letting Partners landlord guide.</h1>
          <p>Your obligations, documents, notices, and best-practice letting steps explained clearly.</p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Key Topics</span>
            <h2>Landlord obligations and best practice.</h2>
            <p>This guide is a practical starting point. For a specific case, speak to Letting Partners directly.</p>
          </div>
          <div className="lp-card-grid lp-card-grid--three" data-lp-animate>
            {guideSections.map((section) => (
              <article key={section.title} className="lp-card">
                <span className="lp-icon-badge">
                  <LPIcon name={section.icon} />
                </span>
                <h3>{section.title}</h3>
                <p>{section.content}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cta">
        <div className="lp-container">
          <div className="lp-cta-band" data-lp-animate>
            <div>
              <span className="lp-kicker lp-kicker--light">Need managed support?</span>
              <h2>Letting Partners can handle the details for you.</h2>
              <p>From safety documents to tenant placement and full management, we help landlords move forward with clarity.</p>
            </div>
            <div className="lp-cta-actions">
              <Link href="/landlord-services/property-letting" className="lp-btn lp-btn--gold">List Your Property</Link>
              <Link href="/contact" className="lp-btn lp-btn--glass">Speak to Letting Partners</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
