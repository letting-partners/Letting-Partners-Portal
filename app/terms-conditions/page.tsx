import type { Metadata } from "next";
import Image from "next/image";
import { PAGE_BANNER_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Terms & Conditions | Letting Partners",
  description: "Letting Partners terms and conditions — the terms governing use of our website and services.",
};

export default function TermsConditionsPage() {
  return (
    <>
      <section className="lp-page-hero">
        <Image
          src={PAGE_BANNER_IMAGES.landlordGuide}
          alt="Terms and Conditions"
          fill
          priority
          sizes="100vw"
          className="lp-cover-img"
        />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">Legal</span>
          <h1>Terms &amp; Conditions</h1>
          <p>The terms governing use of our website and services.</p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container" style={{ maxWidth: 800 }}>
          <p className="lp-text-muted" style={{ marginBottom: "2rem" }}>Last updated: June 2026</p>

          <div className="lp-prose">
            <h2>1. Introduction</h2>
            <p>These terms and conditions govern your use of the Letting Partners website and services. By using our website, you accept these terms in full. If you do not accept these terms, please discontinue use of the site.</p>

            <h2>2. Use of the Website</h2>
            <p>You may use this website for lawful purposes only. You must not use the site in any way that is unlawful or harmful, or in connection with any unlawful or harmful purpose or activity.</p>

            <h2>3. Our Services</h2>
            <p>Letting Partners provides property letting and management services. The information on this website is provided for general guidance only and does not constitute legal or financial advice. You should take independent professional advice before making any property-related decisions.</p>

            <h2>4. Intellectual Property</h2>
            <p>All content on this website — including text, images, and design — is the intellectual property of Letting Partners or its licensors. You may not reproduce, distribute, or otherwise use any content without our prior written consent.</p>

            <h2>5. Liability</h2>
            <p>To the fullest extent permitted by law, Letting Partners excludes all liability for loss or damage arising from your use of this website or reliance on its content.</p>

            <h2>6. Links to Third-Party Sites</h2>
            <p>This website may contain links to third-party websites. We are not responsible for the content or practices of those websites and do not endorse them.</p>

            <h2>7. Governing Law</h2>
            <p>These terms are governed by English law. Any disputes arising in connection with these terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>

            <h2>8. Contact</h2>
            <p>For any questions about these terms, contact us at <a href="mailto:info@lettingpartners.co.uk">info@lettingpartners.co.uk</a> or call <a href="tel:07782273674">07782 273674</a>.</p>
          </div>
        </div>
      </section>
    </>
  );
}
