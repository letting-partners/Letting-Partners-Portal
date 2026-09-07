import Link from "next/link";
import { LogIn } from "lucide-react";

/** Rendered with a 401 when there is no valid session. */
export default function Unauthorized() {
  return (
    <main className="page" style={{ display: "grid", placeItems: "center", minHeight: "70dvh" }}>
      <div className="empty-state" style={{ maxWidth: 460 }}>
        <div className="empty-state-icon">
          <LogIn size={20} />
        </div>
        <h1 style={{ fontSize: "1.25rem" }}>Please sign in</h1>
        <p>Your session has expired or you are not signed in.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <Link href="/login" className="btn btn--primary btn--sm">
            Go to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
