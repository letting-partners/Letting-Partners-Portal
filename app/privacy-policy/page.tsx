import type { Metadata } from "next";
import Image from "next/image";
import { PAGE_BANNER_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Privacy Policy | Letting Partners",
  description: "Letting Partners privacy policy — how we collect, use, and protect your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="lp-page-hero">
        <Image
          src={PAGE_BANNER_IMAGES.specialistLegal}
          alt="Privacy Policy"
          fill
          priority
          sizes="100vw"
          className="lp-cover-img"
        />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">Legal</span>
          <h1>Privacy Policy</h1>
          <p>How we collect, use, and protect your personal information.</p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container" style={{ maxWidth: 800 }}>
          <p className="lp-text-muted" style={{ marginBottom: "2rem" }}>Last updated: June 2026</p>

          <div className="lp-prose">
            <h2>1. Who We Are</h2>
            <p>Letting Partners (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is a property letting and management agency operating in London and Birmingham. Our contact email is <a href="mailto:info@lettingpartners.co.uk">info@lettingpartners.co.uk</a> and our phone number is <a href="tel:07782273674">07782 273674</a>.</p>

            <h2>2. What Information We Collect</h2>
            <p>We collect personal information you provide directly to us, including:</p>
            <ul>
              <li>Name, email address, and phone number from contact and registration forms</li>
              <li>Property requirements and preferences from tenant registration</li>
              <li>Tenancy and financial information relevant to lettings transactions</li>
            </ul>

            <h2>3. How We Use Your Information</h2>
            <p>We use your information to respond to enquiries, match tenant requirements to available properties, process tenancy applications, fulfil our contractual and legal obligations, and send relevant communications where you have consented.</p>

            <h2>4. Legal Basis for Processing</h2>
            <p>We process your personal data on the following lawful bases: contractual necessity, legal obligation, legitimate interests in operating our business, and — where required — your consent.</p>

            <h2>5. Data Retention</h2>
            <p>We retain personal data only for as long as necessary to fulfil the purposes for which it was collected, or as required by applicable law.</p>

            <h2>6. Your Rights</h2>
            <p>Under the UK GDPR, you have the right to access, rectify, erase, restrict, or object to the processing of your personal data. To exercise these rights, contact us at <a href="mailto:info@lettingpartners.co.uk">info@lettingpartners.co.uk</a>.</p>

            <h2>7. Cookies</h2>
            <p>This website uses essential cookies required for the site to function. We do not use third-party tracking or advertising cookies.</p>

            <h2>8. Changes to This Policy</h2>
            <p>We may update this policy from time to time. The most current version will always be available on this page.</p>
          </div>
        </div>
      </section>
    </>
  );
}
