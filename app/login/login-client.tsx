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

export function LoginClient({ initialEmail = "", reason }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (reason === "agent") {
      setMessage({
        type: "error",
        text: "Agent accounts must sign in from the standard login page.",
      });
      return;
    }

    if (reason === "admin") {
      setMessage({
        type: "error",
        text: "Admin accounts must sign in from the admin login page.",
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
      { email: string; password: string; portal: "agent" },
      LoginResponse
    >("/api/auth/login", {
      email: normalizedEmail,
      password,
      portal: "agent",
    });
    setBusy(false);

    if (!result.ok) {
      if (result.error === "ADMIN_LOGIN_REQUIRED") {
        router.push(`/admin/login?email=${encodeURIComponent(normalizedEmail)}&reason=admin`);
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
    window.location.assign(result.data.redirectTo || "/dashboard");
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
            Agent Portal
          </span>

          <h1 className="auth-left-title">
            Your property
            <span className="auth-left-title-accent">management hub.</span>
          </h1>

          <p className="auth-left-desc">
            Access your full property portfolio, coordinate lettings, track maintenance, and manage tenants — all from one secure, professional platform.
          </p>

          <ul className="auth-left-features">
            <li className="auth-left-feature">
              <span className="auth-left-feature-icon">✓</span>
              <div className="auth-left-feature-body">
                <strong>Full Property Portfolio</strong>
                <span>Manage listings, valuations, and availability in one view</span>
              </div>
            </li>
            <li className="auth-left-feature">
              <span className="auth-left-feature-icon">✓</span>
              <div className="auth-left-feature-body">
                <strong>Tenant & Landlord CRM</strong>
                <span>Track leads, applications, and tenancy history instantly</span>
              </div>
            </li>
            <li className="auth-left-feature">
              <span className="auth-left-feature-icon">✓</span>
              <div className="auth-left-feature-body">
                <strong>Secure Two-Factor Login</strong>
                <span>OTP verification keeps your account protected at all times</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="auth-right">
        <div className="auth-right-inner">
          <div className="auth-right-head">
            <h2 className="auth-right-title">Sign in</h2>
            <p className="auth-right-sub">
              Enter your credentials to access your agent portal. OTP is only requested after 12 hours of inactivity.
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
                placeholder="you@agency.com"
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
              {busy ? "Signing in..." : "Continue to portal"}
            </UIButton>
          </form>

          <div className="auth-or-divider">
            <span className="auth-or-text">or</span>
          </div>

          <Link href="/admin/login" className="auth-switch-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Sign in as Administrator
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
