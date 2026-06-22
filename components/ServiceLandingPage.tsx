import Image from "next/image";
import Link from "next/link";
import LPIcon, { type LPIconName } from "@/components/LPIcon";
import type { ServiceGroup } from "@/lib/services";

const GROUP_ICONS: Record<string, LPIconName> = {
  "/tenant-services": "key",
  "/landlord-services": "building",
  "/specialist-legal-support": "scale",
  "/other-services": "wrench",
};

const GROUP_PROCESS = [
  {
    title: "Tell us what you need",
    text: "Share your property, tenancy, tenant search, or support requirement so the right route can be identified.",
  },
  {
    title: "Get a clear recommendation",
    text: "We explain the practical next step, likely documents, timing, and the service path that fits your situation.",
  },
  {
    title: "Move forward with support",
    text: "Letting Partners coordinates the service, keeps communication clear, and helps you avoid avoidable delays.",
  },
];

const GROUP_FAQS = [
  {
    question: "Which service should I choose?",
    answer:
      "If you are unsure, contact us with a short summary. We will point you toward the most suitable service route and explain the next step.",
  },
  {
    question: "Do you cover both London and Birmingham?",
    answer:
      "Yes. Letting Partners operates across key London areas and Birmingham, with support for landlords, tenants, and property owners.",
  },
  {
    question: "Can services be combined?",
    answer:
      "Yes. Many landlords combine letting, management, maintenance, and legal support coordination depending on the property and tenancy stage.",
  },
];

export default function ServiceLandingPage({ group }: { group: ServiceGroup }) {
  const icon = GROUP_ICONS[group.href] ?? "sparkles";

  return (
    <>
      <section className="lp-page-hero lp-page-hero--service">
        <Image
          src={group.image}
          alt={`${group.label} from Letting Partners`}
          fill
          priority
          sizes="100vw"
          className="lp-cover-img"
        />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">{group.eyebrow}</span>
          <h1>{group.label}</h1>
          <p>{group.description}</p>
          <div className="lp-hero-actions">
            <Link href="/contact" className="lp-btn lp-btn--gold">
              Speak to Letting Partners
              <LPIcon name="arrow-right" size={18} />
            </Link>
            <Link href="/properties" className="lp-btn lp-btn--glass">
              Browse Properties
            </Link>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-split lp-split--intro" data-lp-animate>
            <div>
              <span className="lp-kicker">{group.eyebrow}</span>
              <h2>{group.overview}</h2>
            </div>
            <div className="lp-highlight-panel">
              <span className="lp-icon-badge">
                <LPIcon name={icon} />
              </span>
              <ul className="lp-check-list">
                {group.highlights.map((item) => (
                  <li key={item}>
                    <LPIcon name="check" size={17} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Services</span>
            <h2>Explore {group.label}</h2>
            <p>Choose the service that matches your property, tenancy, or search stage.</p>
          </div>

          <div className="lp-card-grid lp-card-grid--three" data-lp-animate>
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className="lp-card lp-card--link">
                <span className="lp-icon-badge">
                  <LPIcon name={item.icon as LPIconName} />
                </span>
                <h3>{item.label}</h3>
                <p>{item.description}</p>
                <span className="lp-text-link">
                  Learn more
                  <LPIcon name="arrow-right" size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">How We Work</span>
            <h2>A clear route from first enquiry to next step.</h2>
          </div>
          <div className="lp-process-list lp-process-list--three" data-lp-animate>
            {GROUP_PROCESS.map((step, index) => (
              <article key={step.title} className="lp-process-item">
                <span className="lp-process-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-faq-layout" data-lp-animate>
            <div>
              <span className="lp-kicker">FAQs</span>
              <h2>Questions about {group.label.toLowerCase()}?</h2>
              <p className="lp-muted-text">Here are the most common starting points.</p>
            </div>
            <div className="lp-faq-list">
              {GROUP_FAQS.map((faq) => (
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

      <section className="lp-section lp-section--cta">
        <div className="lp-container">
          <div className="lp-cta-band" data-lp-animate>
            <div>
              <span className="lp-kicker lp-kicker--light">Start Here</span>
              <h2>Ready to discuss {group.label.toLowerCase()}?</h2>
              <p>Speak to Letting Partners and we will help you choose the right service route.</p>
            </div>
            <div className="lp-cta-actions">
              <Link href="/contact" className="lp-btn lp-btn--gold">
                Speak to Letting Partners
                <LPIcon name="arrow-right" size={18} />
              </Link>
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
