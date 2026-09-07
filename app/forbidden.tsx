import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/** Rendered with a 403 when a signed-in user reaches something not theirs. */
export default function Forbidden() {
  return (
    <main className="page" style={{ display: "grid", placeItems: "center", minHeight: "70dvh" }}>
      <div className="empty-state" style={{ maxWidth: 460 }}>
        <div className="empty-state-icon">
          <ShieldAlert size={20} />
        </div>
        <h1 style={{ fontSize: "1.25rem" }}>You do not have access to this</h1>
        <p>
          Your account does not have permission for this area. If you think it should, ask an
          administrator to check your role.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <Link href="/dashboard" className="btn btn--primary btn--sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
