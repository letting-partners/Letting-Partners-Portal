import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LPIcon, { type LPIconName } from "@/components/LPIcon";
import HomeContactForm from "@/components/HomeContactForm";
import TestimonialsSlider from "@/components/TestimonialsSlider";
import { AREAS, getAreaHref } from "@/lib/areas";
import { AREA_IMAGES, ABOUT_IMAGES, CTA_IMAGES, HERO_IMAGES, LEGAL_IMAGES, PROCESS_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Letting Partners | London & Birmingham Letting, Management & Tenant Services",
  description:
    "Premium UK property letting, management, tenant support, legal coordination, maintenance, mortgage consultancy, and construction support across London and Birmingham.",
  keywords: [
    "letting agents London",
    "property management Birmingham",
    "landlord services London",
    "tenant services London",
    "property letting Ilford",
  ],
};

const stats = [
  { value: "500+", label: "Properties supported" },
  { value: "8", label: "London and Midlands areas" },
  { value: "24h", label: "Typical enquiry response" },
  { value: "360", label: "Degree property support" },
];

const services: Array<{ icon: LPIconName; title: string; text: string; href: string; cta: string }> = [
  {
    icon: "home",
    title: "Property Letting",
    text: "Valuation, marketing, tenant matching, referencing, AST setup, and move-in coordination.",
    href: "/landlord-services/property-letting",
    cta: "List Your Property",
  },
  {
    icon: "building",
    title: "Property Management",
    text: "Rent collection, maintenance coordination, inspections, renewals, and landlord reporting.",
    href: "/landlord-services/property-management",
    cta: "Explore Management",
  },
  {
    icon: "key",
    title: "Tenant Services",
    text: "Tenant registration, property matching, student support, and plain-English renting guidance.",
    href: "/tenant-services",
    cta: "Register as a Tenant",
  },
  {
    icon: "scale",
    title: "Legal Support Coordination",
    text: "Support routes for notices, disputes, rent arrears, possession, and tenancy documentation.",
    href: "/specialist-legal-support",
    cta: "Get Legal Support",
  },
  {
    icon: "wrench",
    title: "Repairs & Maintenance",
    text: "Responsive repairs, contractor coordination, planned maintenance, and completion tracking.",
    href: "/other-services/repair-maintenance",
    cta: "Request Maintenance",
  },
  {
    icon: "hardhat",
    title: "Mortgage & Development",
    text: "Mortgage consultancy plus construction, refurbishment, conversion, and development support.",
    href: "/other-services",
    cta: "Plan Your Next Step",
  },
];

const process = [
  {
    icon: "search" as const,
    title: "Understand the brief",
    text: "We establish the property, tenant, landlord, legal, maintenance, or finance goal before recommending a route.",
    image: PROCESS_IMAGES.discover,
  },
  {
    icon: "clipboard" as const,
    title: "Prepare the plan",
    text: "Documents, pricing, compliance checks, marketing, or repair details are organised before action begins.",
    image: PROCESS_IMAGES.confirm,
  },
  {
    icon: "handshake" as const,
    title: "Coordinate the work",
    text: "Viewings, applications, contractors, legal specialists, or advisers are coordinated with clear communication.",
    image: PROCESS_IMAGES.visit,
  },
  {
    icon: "check-circle" as const,
    title: "Complete and support",
    text: "Move-in, management, maintenance, reporting, or next-stage support is followed through properly.",
    image: PROCESS_IMAGES.support,
  },
];

const why = [
  { icon: "shield" as const, title: "Compliance-led", text: "We keep UK lettings, deposit, safety, and notice requirements visible throughout the process." },
  { icon: "map-pin" as const, title: "Local coverage", text: "Focused support across Ilford, Redbridge, Stratford, Barking, Walthamstow, Croydon, Hounslow, and Birmingham." },
  { icon: "clock" as const, title: "Fast follow-up", text: "Enquiries, viewings, maintenance, and tenant requests are handled with urgency and clarity." },
  { icon: "sparkles" as const, title: "Premium presentation", text: "Listings, service pages, and property communications are clear, polished, and trustworthy." },
  { icon: "headphones" as const, title: "One coordinated route", text: "Letting, management, legal, repair, mortgage, and development support can sit under one practical conversation." },
  { icon: "trending" as const, title: "Income-focused", text: "Our advice is shaped around reducing voids, protecting rent, and improving property value." },
];

const testimonials = [
  {
    name: "Sarah M.",
    role: "Landlord, Ilford",
    text: "Letting Partners handled the letting and then the management. Communication is clear, maintenance is dealt with quickly, and I always know what is happening.",
    stars: 5,
  },
  {
    name: "David O.",
    role: "Tenant, Stratford",
    text: "The application process was straightforward. Costs, referencing, and the move-in steps were explained properly from the start.",
    stars: 5,
  },
  {
    name: "Aisha P.",
    role: "Landlord, Birmingham",
    text: "I wanted a management service that would not need chasing. Their updates and maintenance coordination have made the property much easier to run.",
    stars: 5,
  },
];

const faqs = [
  {
    question: "Which areas does Letting Partners cover?",
    answer:
      "We cover Ilford, Redbridge, Stratford, Barking, Walthamstow, Croydon, Hounslow, Birmingham, and nearby locations where we can provide reliable support.",
  },
  {
    question: "Can you help landlords and tenants?",
    answer:
      "Yes. Landlords can access letting, management, maintenance, legal support coordination, mortgage, and development services. Tenants can register requirements, search properties, and get renting guidance.",
  },
  {
    question: "Do you provide legal advice directly?",
    answer:
      "We coordinate property-side support and connect clients with appropriate SRA-regulated legal specialists where formal legal advice is required.",
  },
  {
    question: "Can I ask for a valuation?",
    answer:
      "Yes. Send your property details and we can advise on rental positioning, preparation, likely tenant demand, and the most suitable letting route.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="lp-home-hero">
        <Image src={HERO_IMAGES.home} alt="London residential property street" fill priority sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay lp-image-overlay--hero" />
        <div className="lp-container lp-home-hero-grid">
          <div className="lp-home-hero-copy" data-lp-animate="fade">
            <span className="lp-kicker lp-kicker--light">London and Birmingham property specialists</span>
            <h1>Premium letting and property support for serious landlords and tenants.</h1>
            <p>
              Letting Partners brings property letting, management, tenant support, legal coordination, maintenance, mortgage consultancy, and development guidance into one polished UK property service.
            </p>
            <div className="lp-hero-actions">
              <Link href="/tenant-services/register-as-tenant" className="lp-btn lp-btn--gold">
                Register as a Tenant
                <LPIcon name="arrow-right" size={18} />
              </Link>
              <Link href="/landlord-services/property-letting" className="lp-btn lp-btn--glass">
                List Your Property
              </Link>
            </div>
          </div>

          <form action="/properties" className="lp-search-card" data-lp-animate="scale">
            <span className="lp-kicker">Property Search</span>
            <h2>Find a rental in your preferred area</h2>
            <div className="lp-form-grid">
              <label>
                Area
                <select name="area">
                  <option value="">Any area</option>
                  {AREAS.map((area) => (
                    <option key={area.slug} value={area.slug}>
                      {area.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Property type
                <select name="type">
                  <option value="">Any type</option>
                  <option>Studio</option>
                  <option>1 Bedroom</option>
                  <option>2 Bedrooms</option>
                  <option>3 Bedrooms</option>
                  <option>HMO / Shared House</option>
                </select>
              </label>
              <label>
                Max budget
                <select name="budget">
                  <option value="">No maximum</option>
                  <option value="1000">&pound;1,000 pcm</option>
                  <option value="1250">&pound;1,250 pcm</option>
                  <option value="1500">&pound;1,500 pcm</option>
                  <option value="2000">&pound;2,000 pcm</option>
                  <option value="2500">&pound;2,500+ pcm</option>
                </select>
              </label>
            </div>
            <button type="submit" className="lp-btn lp-btn--navy">
              <LPIcon name="search" size={18} />
              Search Properties
            </button>
            <Link href="/tenant-services/register-as-tenant" className="lp-text-link">
              Get alerts for matching homes
              <LPIcon name="arrow-right" size={16} />
            </Link>
          </form>
        </div>
      </section>

      <section className="lp-stats-strip" aria-label="Letting Partners trust statistics">
        <div className="lp-container lp-stats-grid" data-lp-animate>
          {stats.map((stat) => (
            <div key={stat.label} className="lp-stat">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-split lp-split--intro" data-lp-animate>
            <div>
              <span className="lp-kicker">Property search and registration</span>
              <h2>Search what is available now, or register before the right property goes public.</h2>
            </div>
            <div className="lp-prose-large">
              <p>
                Not every rental journey starts with a public listing. Register your requirements and we will match your budget, area, property type, and move date against current and upcoming availability.
              </p>
              <div className="lp-inline-actions">
                <Link href="/properties" className="lp-btn lp-btn--navy">Browse Properties</Link>
                <Link href="/tenant-services/register-as-tenant" className="lp-btn lp-btn--outline">Register as a Tenant</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Services</span>
            <h2>Property services for every stage of the rental lifecycle.</h2>
            <p>One professional service partner for letting, managing, maintaining, financing, improving, and resolving property matters.</p>
          </div>
          <div className="lp-card-grid lp-card-grid--three" data-lp-animate>
            {services.map((service) => (
              <Link key={service.href} href={service.href} className="lp-card lp-card--link">
                <span className="lp-icon-badge">
                  <LPIcon name={service.icon} />
                </span>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <span className="lp-text-link">
                  {service.cta}
                  <LPIcon name="arrow-right" size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">How it works</span>
            <h2>A structured process with fewer loose ends.</h2>
          </div>
          <div className="lp-image-process-grid" data-lp-animate>
            {process.map((step, index) => (
              <article key={step.title} className="lp-image-process-card">
                <div className="lp-image-process-media">
                  <Image src={step.image} alt={`${step.title} stage`} fill sizes="(max-width: 800px) 100vw, 25vw" className="lp-cover-img" />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div>
                  <span className="lp-icon-badge lp-icon-badge--sm">
                    <LPIcon name={step.icon} size={18} />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--navy">
        <div className="lp-container lp-feature-split" data-lp-animate>
          <div>
            <span className="lp-kicker lp-kicker--light">Why Letting Partners</span>
            <h2>Premium property support that feels calm, capable, and accountable.</h2>
            <p>
              We combine local market knowledge with disciplined communication, polished presentation, and compliance-aware processes.
            </p>
            <Link href="/contact" className="lp-btn lp-btn--gold">
              Speak to Letting Partners
              <LPIcon name="arrow-right" size={18} />
            </Link>
          </div>
          <div className="lp-mini-card-grid">
            {why.map((item) => (
              <article key={item.title} className="lp-dark-card">
                <span className="lp-icon-badge lp-icon-badge--gold">
                  <LPIcon name={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-split lp-split--image" data-lp-animate>
            <div className="lp-image-frame">
              <Image src={ABOUT_IMAGES.homeAbout} alt="Modern rental property interior" fill sizes="(max-width: 900px) 100vw, 50vw" className="lp-cover-img" />
            </div>
            <div>
              <span className="lp-kicker">A sharper property partner</span>
              <h2>Specialist letting expertise, not a generic estate agency template.</h2>
              <p>
                Letting Partners focuses on the practical work that keeps rental property moving: quality applicants, clear paperwork, maintenance accountability, local area insight, and strong follow-through.
              </p>
              <ul className="lp-check-list">
                <li><LPIcon name="check" size={17} /> London and Birmingham coverage</li>
                <li><LPIcon name="check" size={17} /> Landlord and tenant support routes</li>
                <li><LPIcon name="check" size={17} /> Legal, maintenance, mortgage, and development coordination</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Coverage Areas</span>
            <h2>Local property support across London and Birmingham.</h2>
          </div>
          <div className="lp-area-grid" data-lp-animate>
            {AREAS.map((area) => (
              <Link key={area.slug} href={getAreaHref(area.slug)} className="lp-area-card">
                <Image src={AREA_IMAGES[area.slug] ?? area.image} alt={`${area.title} residential area`} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw" className="lp-cover-img" />
                <div className="lp-area-overlay" />
                <div>
                  <span>{area.coverageLabel}</span>
                  <h3>{area.title}</h3>
                  <p>{area.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-legal-panel">
        <Image src={LEGAL_IMAGES.sectionPanel} alt="Property legal paperwork" fill sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-legal-content" data-lp-animate>
          <span className="lp-kicker lp-kicker--light">When property gets complex</span>
          <h2>Specialist legal support coordination for notices, disputes, arrears, and possession.</h2>
          <p>
            We organise the property context and connect you with appropriate SRA-regulated specialists when formal legal advice is required.
          </p>
          <div className="lp-inline-actions">
            <Link href="/specialist-legal-support" className="lp-btn lp-btn--gold">Explore Legal Support</Link>
            <Link href="/specialist-legal-support/request-support" className="lp-btn lp-btn--glass">Request Support</Link>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Client Feedback</span>
            <h2>Trusted by landlords and tenants who value clear communication.</h2>
          </div>
          <div data-lp-animate>
            <TestimonialsSlider items={testimonials} />
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-faq-layout" data-lp-animate>
            <div>
              <span className="lp-kicker">FAQs</span>
              <h2>Common questions before you get started.</h2>
              <p className="lp-muted-text">A few quick answers for landlords, tenants, and property owners.</p>
            </div>
            <div className="lp-faq-list">
              {faqs.map((faq) => (
                <details key={faq.question} className="lp-faq-item">
                  <summary>
                    <span>{faq.question}</span>
                    <LPIcon name="plus" size={18} />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-contact-cta">
        <Image src={CTA_IMAGES.contactBg} alt="UK residential property exterior" fill sizes="100vw" className="lp-cover-img" />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-contact-cta-grid">
          <div data-lp-animate="slide-right">
            <span className="lp-kicker lp-kicker--light">Speak to Letting Partners</span>
            <h2>Ready to make your next property move clearer?</h2>
            <p>
              Whether you want to list a property, register as a tenant, request maintenance support, or discuss a more complex issue, start here.
            </p>
            <div className="lp-contact-methods">
              <a href="tel:07782273674"><LPIcon name="phone" size={18} /> 07782 273674</a>
              <a href="mailto:info@lettingpartners.co.uk"><LPIcon name="mail" size={18} /> info@lettingpartners.co.uk</a>
            </div>
          </div>
          <div className="lp-contact-card" data-lp-animate="slide-left">
            <HomeContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
