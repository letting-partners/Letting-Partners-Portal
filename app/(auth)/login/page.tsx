/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  // Already signed in: skip the form entirely.
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <img src="/lp-logo.webp" alt={publicEnv.NEXT_PUBLIC_COMPANY_NAME} width={170} height={48} />

        <div>
          <span className="auth-kicker">Staff portal</span>
          <h1>Every call, property and deal in one place.</h1>
          <p>
            Landlord acquisition, property onboarding, viewings, verification, closings and
            commission - connected end to end, with a full history behind every record.
          </p>
        </div>

        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>
          Letting Partners LTD. Registered in England and Wales. Registration No. 17436005.
        </p>
      </aside>

      <main className="auth-main" id="main-content">
        <div className="auth-card">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
