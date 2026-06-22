import type { Metadata } from "next";
import Image from "next/image";
import LPIcon from "@/components/LPIcon";
import TenantRegistrationForm from "@/components/TenantRegistrationForm";
import { PAGE_BANNER_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Register as a Tenant | Letting Partners",
  description:
    "Register your property requirements with Letting Partners and get matched to suitable rental homes across London and Birmingham.",
  keywords: ["register as tenant London", "find rental property London", "tenant registration East London"],
};

const benefits = [
  "Free registration with no obligation.",
  "Matched against current and upcoming listings.",
  "Early contact when a suitable property becomes available.",
  "Guided support from application through to move-in.",
  "Clear guidance on ASTs, referencing, and deposit protection.",
];

export default function RegisterAsTenantPage() {
  return (
    <>
      <section className="lp-page-hero">
        <Image src={PAGE_BANNER_IMAGES.registerTenant} alt="Modern rental apartment interior" fill priority sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">For Renters</span>
          <h1>Register as a tenant.</h1>
          <p>Share your requirements and we will match you to suitable rental properties as they become available.</p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container lp-contact-page-grid" data-lp-animate>
          <div>
            <span className="lp-kicker">How registration works</span>
            <h2>Tell us what you need, then move faster when the right home appears.</h2>
            <p className="lp-muted-text">
              Registration helps us understand your budget, preferred area, property type, move date, and must-have requirements before a property goes live.
            </p>
            <ul className="lp-check-list">
              {benefits.map((benefit) => (
                <li key={benefit}>
                  <LPIcon name="check" size={17} />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-contact-card">
            <TenantRegistrationForm />
          </div>
        </div>
      </section>
    </>
  );
}
