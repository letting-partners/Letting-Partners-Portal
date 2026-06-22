import type { Metadata } from "next";
import Image from "next/image";
import HomeContactForm from "@/components/HomeContactForm";
import LPIcon, { type LPIconName } from "@/components/LPIcon";
import { PAGE_BANNER_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Contact Letting Partners",
  description:
    "Contact Letting Partners for property letting, management, tenant services, legal support coordination, maintenance, mortgage consultancy, and development support.",
  keywords: ["contact Letting Partners", "letting agents London phone", "property enquiry London", "landlord services contact"],
};

const contactDetails: Array<{ icon: LPIconName; label: string; value: string; href?: string }> = [
  { icon: "phone", label: "Phone", value: "07782 273674", href: "tel:07782273674" },
  { icon: "mail", label: "Email", value: "info@lettingpartners.co.uk", href: "mailto:info@lettingpartners.co.uk" },
  { icon: "map-pin", label: "Coverage", value: "London & Birmingham, UK" },
  { icon: "clock", label: "Hours", value: "Mon-Fri 9am-6pm, Sat 10am-4pm" },
];

export default function ContactPage() {
  return (
    <>
      <section className="lp-page-hero">
        <Image src={PAGE_BANNER_IMAGES.contact} alt="UK residential property enquiry" fill priority sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">Contact Letting Partners</span>
          <h1>Talk to us about your property, tenancy, or next move.</h1>
          <p>Send an enquiry and we will route it to the right property service.</p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container lp-contact-page-grid" data-lp-animate>
          <div>
            <span className="lp-kicker">Get in touch</span>
            <h2>Clear answers, practical next steps.</h2>
            <p className="lp-muted-text">
              Use the form for landlord, tenant, legal, maintenance, mortgage, or development enquiries. For urgent matters, call directly.
            </p>
            <div className="lp-contact-detail-cards">
              {contactDetails.map((detail) => (
                <div key={detail.label} className="lp-contact-detail-card">
                  <span className="lp-icon-badge lp-icon-badge--sm">
                    <LPIcon name={detail.icon} size={18} />
                  </span>
                  <div>
                    <small>{detail.label}</small>
                    {detail.href ? <a href={detail.href}>{detail.value}</a> : <p>{detail.value}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-contact-card">
            <HomeContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
