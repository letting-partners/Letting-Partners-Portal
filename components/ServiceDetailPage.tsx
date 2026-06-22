import Image from "next/image";
import Link from "next/link";
import LPIcon from "@/components/LPIcon";
import type { ServiceDetailPageData } from "@/lib/service-pages";

type Props = {
  service: ServiceDetailPageData;
};

export default function ServiceDetailPage({ service }: Props) {
  return (
    <>
      <section className="lp-page-hero lp-page-hero--service">
        <Image
          src={service.image}
          alt={`${service.title} property service`}
          fill
          priority
          sizes="100vw"
          className="lp-cover-img"
        />
        <div className="lp-image-overlay" />
        <div className="lp-container lp-page-hero-content">
          <span className="lp-kicker lp-kicker--light">{service.eyebrow}</span>
          <h1>{service.heroTitle}</h1>
          <p>{service.heroText}</p>
          <div className="lp-hero-actions">
            <Link href={service.primaryCta.href} className="lp-btn lp-btn--gold">
              {service.primaryCta.label}
              <LPIcon name="arrow-right" size={18} />
            </Link>
            {service.secondaryCta && (
              <Link href={service.secondaryCta.href} className="lp-btn lp-btn--glass">
                {service.secondaryCta.label}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-split lp-split--intro" data-lp-animate>
            <div>
              <span className="lp-kicker">{service.title}</span>
              <h2>{service.introTitle}</h2>
            </div>
            <div className="lp-prose-large">
              <p>{service.introText}</p>
            </div>
          </div>

          <div className="lp-card-grid lp-card-grid--four lp-benefit-grid" data-lp-animate>
            {service.benefits.map((benefit) => (
              <article key={benefit.title} className="lp-card lp-card--interactive">
                <span className="lp-icon-badge">
                  <LPIcon name={benefit.icon} />
                </span>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-section-head" data-lp-animate>
            <span className="lp-kicker">Process</span>
            <h2>How {service.title} works</h2>
            <p>Clear stages, practical handover points, and no guesswork.</p>
          </div>
          <div className="lp-process-list" data-lp-animate>
            {service.process.map((step, index) => (
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

      <section className="lp-section lp-section--navy lp-service-why">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--light" data-lp-animate>
            <span className="lp-kicker lp-kicker--light">Why Choose This Service</span>
            <h2>{service.whyTitle}</h2>
            <p>{service.whyLead}</p>
          </div>
          <div className="lp-card-grid lp-card-grid--four" data-lp-animate>
            {service.why.map((item) => (
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
          <div className="lp-faq-layout" data-lp-animate>
            <div>
              <span className="lp-kicker">FAQs</span>
              <h2>{service.title} questions, answered.</h2>
              <p className="lp-muted-text">
                Straight answers before you make a decision. For specific cases, speak to Letting Partners directly.
              </p>
            </div>
            <div className="lp-faq-list">
              {service.faqs.map((faq) => (
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
              <span className="lp-kicker lp-kicker--light">Next Step</span>
              <h2>{service.ctaTitle}</h2>
              <p>{service.ctaText}</p>
            </div>
            <div className="lp-cta-actions">
              <Link href={service.primaryCta.href} className="lp-btn lp-btn--gold">
                {service.primaryCta.label}
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
