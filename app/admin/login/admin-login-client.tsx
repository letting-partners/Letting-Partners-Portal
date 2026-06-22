"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
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
    <div className="auth-page">
      <div className="auth-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lp-logo.webp" alt="Letting Partners" className="auth-logo" />
        <h1 className="auth-title">Admin Sign In</h1>
        <p className="auth-subtitle">Use your admin credentials to sign in. OTP is only requested after 12 hours of inactivity.</p>
      </div>

      <UICard style={{ width: "100%", maxWidth: 420 }}>
        <UICardBody>
          <form className="field-grid" onSubmit={onSubmit}>
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

            {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : null}

            <UIButton type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              {busy ? "Signing in..." : "Continue"}
            </UIButton>
          </form>
        </UICardBody>
      </UICard>
    </div>
  );
}
