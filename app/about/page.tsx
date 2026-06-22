import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LPIcon, { type LPIconName } from "@/components/LPIcon";
import { ABOUT_IMAGES, PAGE_BANNER_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "About Letting Partners",
  description:
    "Learn about Letting Partners, a UK property letting and management company supporting landlords, tenants, and property owners across London and Birmingham.",
  keywords: ["about Letting Partners", "UK letting agency", "London property management", "Birmingham landlord services"],
};

const values: Array<{ icon: LPIconName; title: string; text: string }> = [
  { icon: "shield", title: "Compliance-led", text: "Lettings, deposits, safety documents, notices, and tenancy setup are treated with proper care." },
  { icon: "clock", title: "Responsive", text: "Property enquiries, tenant updates, repairs, and landlord requests are followed up quickly." },
  { icon: "map-pin", title: "Local", text: "Our work is focused across London and Birmingham markets with practical area insight." },
  { icon: "handshake", title: "Transparent", text: "We keep fees, responsibilities, documents, and next steps clear from the start." },
];

const principles = [
  "Focused on residential letting, management, tenant support, and connected property services.",
  "Built for landlords who need income protected and tenants who need clear communication.",
  "Designed around practical follow-through, not one-off transactions.",
];

export default function AboutPage() {
  return (
    <>
      <section className="lp-page-hero">
        <Image src={PAGE_BANNER_IMAGES.about} alt="Premium UK residential property" fill priority sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">About Letting Partners</span>
          <h1>Specialist property support across London and Birmingham.</h1>
          <p>Letting, management, tenant support, legal coordination, maintenance, mortgage guidance, and development support under one professional property brand.</p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-split lp-split--image" data-lp-animate>
            <div>
              <span className="lp-kicker">Our focus</span>
              <h2>Built around clear, accountable property work.</h2>
              <p>
                Letting Partners supports landlords, tenants, and property owners who want a calm, professional route through the rental lifecycle. From listing and tenant placement to management, repairs, legal support coordination, and property improvement, our role is to make the next step clear.
              </p>
              <ul className="lp-check-list">
                {principles.map((item) => (
                  <li key={item}>
                    <LPIcon name="check" size={17} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-image-frame">
              <Image src={ABOUT_IMAGES.homeAbout} alt="Modern managed rental interior" fill sizes="(max-width: 900px) 100vw, 50vw" className="lp-cover-img" />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">What Drives Us</span>
            <h2>Professional standards that show up in the details.</h2>
          </div>
          <div className="lp-card-grid lp-card-grid--four" data-lp-animate>
            {values.map((value) => (
              <article key={value.title} className="lp-card">
                <span className="lp-icon-badge">
                  <LPIcon name={value.icon} />
                </span>
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--navy">
        <div className="lp-container lp-feature-split" data-lp-animate>
          <div>
            <span className="lp-kicker lp-kicker--light">How we help</span>
            <h2>One coordinated property conversation, multiple specialist routes.</h2>
          </div>
          <div className="lp-mini-card-grid">
            {[
              ["Landlords", "Letting, management, tenant-find, rent-to-rent, compliance, and maintenance support."],
              ["Tenants", "Registration, property matching, student accommodation, and plain-English renting guidance."],
              ["Property Owners", "Mortgage consultancy, repairs, refurbishment, construction, and development support."],
              ["Complex Cases", "Coordinated routes for disputes, notices, rent arrears, and possession matters."],
            ].map(([title, text]) => (
              <article key={title} className="lp-dark-card">
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cta">
        <div className="lp-container">
          <div className="lp-cta-band" data-lp-animate>
            <div>
              <span className="lp-kicker lp-kicker--light">Start a conversation</span>
              <h2>Need a property partner who can coordinate the detail?</h2>
              <p>Speak to Letting Partners about your property, tenancy, or next investment move.</p>
            </div>
            <div className="lp-cta-actions">
              <Link href="/contact" className="lp-btn lp-btn--gold">Speak to Letting Partners</Link>
              <a href="tel:07782273674" className="lp-btn lp-btn--glass">
                <LPIcon name="phone" size={18} />
                07782 273674
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
