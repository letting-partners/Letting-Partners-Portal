"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { apiPost } from "@/lib/api-client";

type LoginResponse = {
  ok: true;
  message: string;
  requiresOtp: boolean;
  redirectTo: string;
};

type Props = {
  initialEmail?: string;
  reason?: string;
};

export function AdminLoginClient({ initialEmail = "", reason }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (reason === "admin") {
      setMessage({
        type: "error",
        text: "Admin accounts must sign in from the admin login page.",
      });
      return;
    }

    if (reason === "agent") {
      setMessage({
        type: "error",
        text: "Agent accounts must sign in from the standard login page.",
      });
    }
  }, [reason]);

  function validate() {
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!validate()) {
      return;
    }

    setBusy(true);
    const normalizedEmail = email.trim().toLowerCase();
    const result = await apiPost<
      { email: string; password: string; portal: "admin" },
      LoginResponse
    >("/api/auth/login", {
      email: normalizedEmail,
      password,
      portal: "admin",
    });
    setBusy(false);

    if (!result.ok) {
      if (result.error === "AGENT_LOGIN_REQUIRED") {
        router.push(`/login?email=${encodeURIComponent(normalizedEmail)}&reason=agent`);
        return;
      }

      const errorMessage =
        result.error === "INVALID_CREDENTIALS"
          ? "Invalid email or password."
          : result.error === "OTP_SEND_RATE_LIMIT"
            ? "Too many OTP requests. Please wait and try again."
            : result.message ?? "Unable to sign in.";
      setMessage({ type: "error", text: errorMessage });
      return;
    }

    if (result.data.requiresOtp) {
      setMessage({ type: "success", text: "OTP sent. Check your email." });
      router.push(result.data.redirectTo);
      return;
    }

    setMessage({ type: "success", text: "Signed in. Redirecting..." });
    window.location.assign(result.data.redirectTo || "/admin");
  }

  return (
    <div className="auth-split">
      {/* ── Left: brand panel ── */}
      <div className="auth-left">
        <div className="auth-left-glow-a" />
        <div className="auth-left-glow-b" />
        <div className="auth-left-grid" />

        <div className="auth-left-content">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lp-logo.webp" alt="Letting Partners" className="auth-left-logo" />

          <span className="auth-left-badge">
            <span className="auth-left-badge-dot" />
            Administration Portal
          </span>

          <h1 className="auth-left-title">
            Complete control
            <span className="auth-left-title-accent">at your fingertips.</span>
          </h1>

          <p className="auth-left-desc">
            The Letting Partners admin console gives you oversight of every agent, property, tenant, and commission record — with audit trails and real-time reporting.
          </p>

          <ul className="auth-left-features">
            <li className="auth-left-feature">
              <span className="auth-left-feature-icon">✓</span>
              <div className="auth-left-feature-body">
                <strong>Agent & Performance Management</strong>
                <span>Monitor agent activity, commissions, and KPIs in real time</span>
              </div>
            </li>
            <li className="auth-left-feature">
              <span className="auth-left-feature-icon">✓</span>
              <div className="auth-left-feature-body">
                <strong>Full Platform Oversight</strong>
                <span>Access all properties, landlords, tenants, and sales records</span>
              </div>
            </li>
            <li className="auth-left-feature">
              <span className="auth-left-feature-icon">✓</span>
              <div className="auth-left-feature-body">
                <strong>Audit Log & Compliance</strong>
                <span>Every action is tracked with timestamped audit entries</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="auth-right">
        <div className="auth-right-inner">
          <div className="auth-right-head">
            <h2 className="auth-right-title">Admin sign in</h2>
            <p className="auth-right-sub">
              Use your administrator credentials to access the control panel. OTP is only requested after 12 hours of inactivity.
            </p>
          </div>

          {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : null}

          <form className="field-grid" onSubmit={onSubmit} style={{ marginTop: "1.25rem" }}>
            <label className="field">
              <span className="label">Email address</span>
              <UIInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@agency.com"
                autoComplete="email"
              />
              {errors.email ? <span className="error-text">{errors.email}</span> : null}
            </label>

            <label className="field">
              <span className="label">Password</span>
              <UIInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
              />
              {errors.password ? <span className="error-text">{errors.password}</span> : null}
            </label>

            <UIButton
              type="submit"
              disabled={busy}
              style={{ width: "100%", justifyContent: "center", marginTop: "0.25rem" }}
            >
              {busy ? "Signing in..." : "Access admin console"}
            </UIButton>
          </form>

          <div className="auth-or-divider">
            <span className="auth-or-text">or</span>
          </div>

          <Link href="/login" className="auth-switch-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Sign in as Agent instead
          </Link>

          <p className="auth-back">
            Back to{" "}
            <a href="/">Letting Partners website</a>
          </p>
        </div>
      </div>
    </div>
  );
}
