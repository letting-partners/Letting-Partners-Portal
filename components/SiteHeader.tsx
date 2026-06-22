"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LPIcon, { type LPIconName } from "@/components/LPIcon";
import { AREAS, getAreaHref } from "@/lib/areas";
import { LOGO } from "@/lib/images";
import { SERVICE_GROUPS, isServicesCurrent } from "@/lib/services";

const topLinks = [
  { label: "Home", href: "/" },
  { label: "Properties", href: "/properties" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const serviceIcons: Record<string, LPIconName> = {
  "/tenant-services": "key",
  "/landlord-services": "building",
  "/specialist-legal-support": "scale",
  "/other-services": "wrench",
};

export default function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<"services" | "areas" | null>(null);
  const [mobileGroup, setMobileGroup] = useState<"services" | "areas" | null>("services");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const areaActive = pathname.startsWith("/areas");
  const servicesActive = isServicesCurrent(pathname);

  return (
    <>
      <header className={`lp-header${scrolled ? " lp-header--scrolled" : ""}`}>
        <div className="lp-container lp-header-inner">
          <Link href="/" className="lp-header-logo" aria-label="Letting Partners home">
            <Image src={LOGO.main} alt="Letting Partners" width={190} height={54} priority />
          </Link>

          <nav className="lp-desktop-nav" aria-label="Primary navigation">
            <Link className={pathname === "/" ? "is-active" : ""} href="/">
              Home
            </Link>

            <div
              className="lp-nav-dropdown"
              onMouseEnter={() => setOpenMenu("services")}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button
                type="button"
                className={servicesActive ? "is-active" : ""}
                aria-expanded={openMenu === "services"}
                aria-controls="lp-services-menu"
                onClick={() => setOpenMenu(openMenu === "services" ? null : "services")}
              >
                Services
                <LPIcon name="chevron-down" size={16} />
              </button>
              {openMenu === "services" && (
                <div id="lp-services-menu" className="lp-mega lp-mega--services">
                  <div className="lp-mega-intro">
                    <span>Complete property support</span>
                    <h2>Services for landlords, tenants, and property owners.</h2>
                    <p>Choose a route, or speak with us if you are not sure where to start.</p>
                  </div>
                  <div className="lp-mega-service-grid">
                    {SERVICE_GROUPS.map((group) => (
                      <section key={group.href} className="lp-mega-service-group">
                        <Link href={group.href} className="lp-mega-group-title">
                          <span className="lp-icon-badge lp-icon-badge--sm">
                            <LPIcon name={serviceIcons[group.href] ?? "sparkles"} size={18} />
                          </span>
                          {group.label}
                        </Link>
                        <ul>
                          {group.items.map((item) => (
                            <li key={item.href}>
                              <Link href={item.href}>{item.label}</Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div
              className="lp-nav-dropdown"
              onMouseEnter={() => setOpenMenu("areas")}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button
                type="button"
                className={areaActive ? "is-active" : ""}
                aria-expanded={openMenu === "areas"}
                aria-controls="lp-areas-menu"
                onClick={() => setOpenMenu(openMenu === "areas" ? null : "areas")}
              >
                Areas
                <LPIcon name="chevron-down" size={16} />
              </button>
              {openMenu === "areas" && (
                <div id="lp-areas-menu" className="lp-mega lp-mega--areas">
                  <div className="lp-mega-intro">
                    <span>London and Birmingham</span>
                    <h2>Local letting support where demand is moving.</h2>
                    <p>Explore area guides, market highlights, and services available nearby.</p>
                  </div>
                  <div className="lp-mega-area-grid">
                    {AREAS.map((area) => (
                      <Link key={area.slug} href={getAreaHref(area.slug)}>
                        <span>{area.title}</span>
                        <small>{area.coverageLabel}</small>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {topLinks.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`)) ? "is-active" : ""}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="lp-header-actions">
            <a href="tel:07782273674" className="lp-phone-link">
              <LPIcon name="phone" size={17} />
              07782 273674
            </a>
            <Link href="/login" className="lp-btn lp-btn--outline lp-btn--sm">
              <LPIcon name="key" size={15} />
              Sign In
            </Link>
            <Link href="/contact" className="lp-btn lp-btn--gold lp-btn--sm">
              Speak to Us
            </Link>
          </div>

          <button
            type="button"
            className="lp-menu-button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            <LPIcon name={mobileOpen ? "x" : "menu"} size={24} />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="lp-mobile-shell" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <div className="lp-mobile-panel">
            <div className="lp-mobile-panel-head">
              <Image src={LOGO.main} alt="Letting Partners" width={154} height={44} />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <LPIcon name="x" size={24} />
              </button>
            </div>

            <nav className="lp-mobile-nav" aria-label="Mobile primary navigation">
              {topLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}

              <button
                type="button"
                aria-expanded={mobileGroup === "services"}
                onClick={() => setMobileGroup(mobileGroup === "services" ? null : "services")}
              >
                Services
                <LPIcon name="chevron-down" size={17} />
              </button>
              {mobileGroup === "services" && (
                <div className="lp-mobile-subnav">
                  {SERVICE_GROUPS.map((group) => (
                    <div key={group.href}>
                      <Link href={group.href} className="lp-mobile-subnav-heading">
                        {group.label}
                      </Link>
                      {group.items.map((item) => (
                        <Link key={item.href} href={item.href}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                aria-expanded={mobileGroup === "areas"}
                onClick={() => setMobileGroup(mobileGroup === "areas" ? null : "areas")}
              >
                Areas
                <LPIcon name="chevron-down" size={17} />
              </button>
              {mobileGroup === "areas" && (
                <div className="lp-mobile-subnav lp-mobile-subnav--areas">
                  {AREAS.map((area) => (
                    <Link key={area.slug} href={getAreaHref(area.slug)}>
                      {area.title}
                    </Link>
                  ))}
                  <Link href="/areas" className="lp-mobile-subnav-heading">
                    All Areas
                  </Link>
                </div>
              )}
            </nav>

            <div className="lp-mobile-contact">
              <a href="tel:07782273674">
                <LPIcon name="phone" size={17} />
                07782 273674
              </a>
              <a href="mailto:info@lettingpartners.co.uk">
                <LPIcon name="mail" size={17} />
                info@lettingpartners.co.uk
              </a>
              <Link href="/contact" className="lp-btn lp-btn--gold">
                Speak to Letting Partners
              </Link>
            </div>
          </div>
          <button className="lp-mobile-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
