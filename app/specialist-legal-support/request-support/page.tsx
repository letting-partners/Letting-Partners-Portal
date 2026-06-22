import type { Metadata } from "next";
import Image from "next/image";
import LegalSupportForm from "@/components/LegalSupportForm";
import LPIcon from "@/components/LPIcon";
import { PAGE_BANNER_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Request Legal Support | Letting Partners",
  description:
    "Request specialist legal support coordination from Letting Partners for tenancy disputes, notices, rent arrears, and possession matters.",
  keywords: ["request legal support landlord London", "tenancy legal advice London", "specialist legal support property"],
};

const steps = [
  "Share the tenancy background, dates, issue, and desired outcome.",
  "We review the property-side context and identify the likely support route.",
  "Where legal advice is required, we connect you with the appropriate specialist.",
  "Letting Partners remains a practical coordination point for property details.",
];

export default function RequestLegalSupportPage() {
  return (
    <>
      <section className="lp-page-hero">
        <Image src={PAGE_BANNER_IMAGES.requestSupport} alt="Property legal support paperwork" fill priority sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">Legal Support</span>
          <h1>Request legal support coordination.</h1>
          <p>Tell us about your situation and we will help identify the right specialist support route.</p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container lp-contact-page-grid" data-lp-animate>
          <div>
            <span className="lp-kicker">How it works</span>
            <h2>Start with the facts, then move to the right route.</h2>
            <p className="lp-muted-text">
              We coordinate property-side information and connect clients with SRA-regulated legal specialists where formal advice is needed.
            </p>
            <ul className="lp-check-list">
              {steps.map((step) => (
                <li key={step}>
                  <LPIcon name="check" size={17} />
                  {step}
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-contact-card">
            <LegalSupportForm />
          </div>
        </div>
      </section>
    </>
  );
}
