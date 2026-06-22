"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLogoutButton } from "@/components/nav-logout-button";
import type { UserRole } from "@prisma/client";

type Session = {
  email: string;
  role: UserRole;
} | null;

type Props = {
  session: Session;
  children: React.ReactNode;
};

export function AppShell({ session, children }: Props) {
  const pathname = usePathname();

  // Admin pages have their own full layout via AdminShell
  if (pathname?.startsWith("/admin")) {
    return <>{children}</>;
  }

  // Protected agent routes have their own full layout via AgentShell
  const isProtectedPath =
    pathname === "/dashboard" ||
    pathname?.startsWith("/landlords") ||
    pathname?.startsWith("/portal/properties") ||
    pathname?.startsWith("/sales") ||
    pathname?.startsWith("/tenants") ||
    pathname?.startsWith("/profile") ||
    pathname?.startsWith("/dialer") ||
    pathname?.startsWith("/messages") ||
    pathname?.startsWith("/potential-tenants") ||
    pathname?.startsWith("/potential-landlords") ||
    pathname?.startsWith("/daily-reports") ||
    pathname?.startsWith("/call-records") ||
    pathname?.startsWith("/notes") ||
    pathname?.startsWith("/templates");

  if (isProtectedPath) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <Link href={session ? "/dashboard" : "/"} className="brand-link">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lp-logo.webp"
              alt="Letting Partners"
              className="logo-img"
            />
          </Link>

          <nav className="nav-links">
            {session ? (
              <>
                <Link className="nav-link" href="/dashboard">
                  Dashboard
                </Link>
                <Link className="nav-link" href="/landlords">
                  Landlords
                </Link>
                <Link className="nav-link" href="/portal/properties">
                  Properties
                </Link>
                <Link className="nav-link" href="/sales">
                  Sales
                </Link>
                <Link className="nav-link" href="/tenants">
                  Tenants
                </Link>
                <Link className="nav-link" href="/profile">
                  Profile
                </Link>
                {session.role === "ADMIN" && (
                  <Link className="nav-link" href="/admin">
                    Admin
                  </Link>
                )}
                <Link className="nav-link nav-link-cta" href="/landlords/new">
                  + Add Property
                </Link>
                <span className="nav-divider" />
                <span className="nav-user">{session.email}</span>
                <NavLogoutButton />
              </>
            ) : (
              <Link className="nav-link nav-link-cta" href="/login">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="app-shell">{children}</main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span className="footer-copy">
            &copy; {new Date().getFullYear()} Letting Partners. All rights reserved.
          </span>
          <a
            className="footer-link"
            href="https://itmetasolutions.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Design &amp; Development by IT Meta Solutions
          </a>
          <span className="footer-tag">Letting Partners Portal</span>
        </div>
      </footer>
    </>
  );
}
