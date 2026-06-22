import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AreaFaqAccordion from "@/components/AreaFaqAccordion";
import LPIcon, { type LPIconName } from "@/components/LPIcon";
import PropertiesGrid from "@/components/PropertiesGrid";
import { AREAS, getAreaBySlug, getAreaPropertiesHref } from "@/lib/areas";
import { AREA_BANNER_IMAGES } from "@/lib/images";

type Props = { params: { slug: string } };

const areaServices: Array<{ icon: LPIconName; title: string; text: string; href: string }> = [
  { icon: "home", title: "Property Letting", text: "Market appraisal, listing, viewings, referencing, and tenancy setup.", href: "/landlord-services/property-letting" },
  { icon: "building", title: "Property Management", text: "Rent, maintenance, inspections, renewals, and reporting.", href: "/landlord-services/property-management" },
  { icon: "key", title: "Tenant Services", text: "Registration, property matching, application support, and move-in guidance.", href: "/tenant-services" },
  { icon: "wrench", title: "Repairs & Maintenance", text: "Responsive repair coordination and planned property care.", href: "/other-services/repair-maintenance" },
];

export async function generateStaticParams() {
  return AREAS.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const area = getAreaBySlug(slug);
  if (!area) return {};
  return {
    title: area.seoTitle,
    description: area.seoDescription,
    keywords: [
      `property letting ${area.title}`,
      `rental properties ${area.title}`,
      `landlord services ${area.title}`,
      `letting agents ${area.title}`,
    ],
  };
}

export default async function AreaPage({ params }: Props) {
  const { slug } = params;
  const area = getAreaBySlug(slug);
  if (!area) notFound();

  const bannerImage = AREA_BANNER_IMAGES[slug] ?? area.image;

  return (
    <>
      <section className="lp-page-hero lp-page-hero--area">
        <Image src={bannerImage} alt={`${area.title} property and street scene`} fill priority sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">{area.coverageLabel}</span>
          <h1>Letting and property management in {area.title}.</h1>
          <p>{area.description} Letting Partners supports local landlords, tenants, and property owners with clear, professional service.</p>
          <div className="lp-hero-actions">
            <Link href={getAreaPropertiesHref(area.slug)} className="lp-btn lp-btn--gold">
              View {area.title} Properties
              <LPIcon name="arrow-right" size={18} />
            </Link>
            <Link href="/contact" className="lp-btn lp-btn--glass">
              Speak to Letting Partners
            </Link>
          </div>
        </div>
      </section>

      <section className="lp-stats-strip" aria-label={`${area.title} rental market highlights`}>
        <div className="lp-container lp-stats-grid" data-lp-animate>
          {area.stats.map((stat) => (
            <div key={stat.label} className="lp-stat">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-split lp-split--image" data-lp-animate>
            <div>
              <span className="lp-kicker">Local market intro</span>
              <h2>{area.title} rental market overview.</h2>
              <p>{area.overview}</p>
              <p>{area.marketSummary}</p>
              <ul className="lp-check-list">
                {area.focusPoints.map((point) => (
                  <li key={point}>
                    <LPIcon name="check" size={17} />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-image-frame">
              <Image src={area.image} alt={`${area.title} residential property`} fill sizes="(max-width: 900px) 100vw, 50vw" className="lp-cover-img" />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Transport, lifestyle, property types</span>
            <h2>Why renters and landlords look closely at {area.title}.</h2>
          </div>
          <div className="lp-card-grid lp-card-grid--three" data-lp-animate>
            <article className="lp-card">
              <span className="lp-icon-badge"><LPIcon name="train" /></span>
              <h3>Transport and commuting</h3>
              <p>{area.focusPoints[0]}</p>
            </article>
            <article className="lp-card">
              <span className="lp-icon-badge"><LPIcon name="map-pin" /></span>
              <h3>Lifestyle and neighbourhoods</h3>
              <p>{area.neighbourhoods.join(", ")} are key local pockets we regularly discuss with clients.</p>
            </article>
            <article className="lp-card">
              <span className="lp-icon-badge"><LPIcon name="home" /></span>
              <h3>Property mix</h3>
              <p>{area.focusPoints[1] ?? "A practical mix of flats, houses, rooms, and managed rental homes supports different tenant needs."}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Services in {area.title}</span>
            <h2>Letting Partners services available locally.</h2>
          </div>
          <div className="lp-card-grid lp-card-grid--four" data-lp-animate>
            {areaServices.map((service) => (
              <Link key={service.href} href={service.href} className="lp-card lp-card--link">
                <span className="lp-icon-badge"><LPIcon name={service.icon} /></span>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <span className="lp-text-link">Learn more <LPIcon name="arrow-right" size={16} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--navy">
        <div className="lp-container lp-feature-split" data-lp-animate>
          <div>
            <span className="lp-kicker lp-kicker--light">For tenants and landlords</span>
            <h2>Two sides of the {area.title} rental market, one coordinated service.</h2>
          </div>
          <div className="lp-mini-card-grid">
            <article className="lp-dark-card">
              <span className="lp-icon-badge lp-icon-badge--gold"><LPIcon name="key" /></span>
              <h3>For Tenants</h3>
              <ul className="lp-check-list lp-check-list--dark">
                {area.tenantHighlights.map((highlight) => (
                  <li key={highlight}><LPIcon name="check" size={17} /> {highlight}</li>
                ))}
              </ul>
              <Link href="/tenant-services/register-as-tenant" className="lp-btn lp-btn--gold lp-btn--sm">Register as a Tenant</Link>
            </article>
            <article className="lp-dark-card">
              <span className="lp-icon-badge lp-icon-badge--gold"><LPIcon name="building" /></span>
              <h3>For Landlords</h3>
              <ul className="lp-check-list lp-check-list--dark">
                {area.landlordHighlights.map((highlight) => (
                  <li key={highlight}><LPIcon name="check" size={17} /> {highlight}</li>
                ))}
              </ul>
              <Link href="/landlord-services/property-letting" className="lp-btn lp-btn--gold lp-btn--sm">List Your Property</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Available now</span>
            <h2>Properties in {area.title}.</h2>
          </div>
          <PropertiesGrid area={area.slug} limit={6} />
          <div className="lp-section-actions">
            <Link href={getAreaPropertiesHref(area.slug)} className="lp-btn lp-btn--outline">
              View all {area.title} properties
              <LPIcon name="arrow-right" size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-faq-layout" data-lp-animate>
            <div>
              <span className="lp-kicker">Local FAQs</span>
              <h2>{area.title} questions, answered.</h2>
              <p className="lp-muted-text">Local rental market questions for tenants, landlords, and property owners.</p>
            </div>
            <AreaFaqAccordion faqs={area.faqs} />
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cta">
        <div className="lp-container">
          <div className="lp-cta-band" data-lp-animate>
            <div>
              <span className="lp-kicker lp-kicker--light">{area.title}</span>
              <h2>Ready to get started in {area.title}?</h2>
              <p>Register as a tenant, list your property, or ask for local market guidance.</p>
            </div>
            <div className="lp-cta-actions">
              <Link href="/tenant-services/register-as-tenant" className="lp-btn lp-btn--gold">Register as a Tenant</Link>
              <Link href="/contact" className="lp-btn lp-btn--glass">Speak to Letting Partners</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
