import Link from "next/link";
import LPIcon from "@/components/LPIcon";

export default function NotFound() {
  return (
    <section
      className="lp-page-hero"
      style={{ alignItems: "center", minHeight: "100svh" }}
    >
      <div className="lp-container lp-page-hero-content" style={{ textAlign: "center" }}>
        <span className="lp-kicker lp-kicker--light">Error</span>
        <h1>Page not found.</h1>
        <p>The page you are looking for does not exist or has been moved.</p>
        <div className="lp-inline-actions lp-inline-actions--center">
          <Link href="/" className="lp-btn lp-btn--gold">
            <LPIcon name="home" size={17} />
            Go Home
          </Link>
          <Link href="/contact" className="lp-btn lp-btn--glass">Contact Us</Link>
        </div>
      </div>
    </section>
  );
}
