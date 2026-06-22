"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
import { UIInput } from "@/components/ui/input";
import { apiPost } from "@/lib/api-client";

type VerifyResponse = {
  ok: true;
  redirectTo: string;
};

type Props = {
  initialEmail?: string;
  reason?: string;
};

export function AdminVerifyOtpClient({ initialEmail = "", reason }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [errors, setErrors] = useState<{ email?: string; otpCode?: string }>({});

  useEffect(() => {
    if (reason === "agent") {
      setMessage({
        type: "error",
        text: "Agent accounts must complete sign-in from the standard login page.",
      });
      return;
    }

    if (reason === "admin") {
      setMessage({
        type: "error",
        text: "Admin accounts must complete sign-in from the admin login page.",
      });
    }
  }, [reason]);

  function validate() {
    const nextErrors: { email?: string; otpCode?: string } = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!/^\d{6}$/.test(otpCode.trim())) {
      nextErrors.otpCode = "Enter a 6-digit code.";
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
      { email: string; otpCode: string; portal: "admin" },
      VerifyResponse
    >("/api/auth/verify-otp", {
      email: normalizedEmail,
      otpCode: otpCode.trim(),
      portal: "admin",
    });
    setBusy(false);

    if (!result.ok) {
      if (result.error === "AGENT_LOGIN_REQUIRED") {
        router.push(`/login?email=${encodeURIComponent(normalizedEmail)}&reason=agent`);
        return;
      }

      const text =
        result.error === "OTP_INVALID"
          ? "The OTP code is incorrect."
          : result.error === "OTP_EXPIRED"
            ? "The OTP code has expired. Request a new one from the admin sign-in page."
            : result.error === "OTP_ATTEMPTS_EXCEEDED"
              ? "Too many incorrect OTP attempts."
              : result.error === "OTP_VERIFY_RATE_LIMIT"
                ? "Too many verification attempts. Please wait."
                : result.message ?? "Failed to verify OTP.";
      setMessage({ type: "error", text });
      return;
    }

    setMessage({ type: "success", text: "Verified. Redirecting to admin dashboard..." });
    window.location.assign(result.data.redirectTo || "/admin");
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lp-logo.webp" alt="Letting Partners" className="auth-logo" />
        <h1 className="auth-title">Admin OTP Verification</h1>
        <p className="auth-subtitle">Enter the 6-digit code sent to your admin email address.</p>
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
              <span className="label">One-time code</span>
              <UIInput
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="123456"
                autoComplete="one-time-code"
              />
              {errors.otpCode ? <span className="error-text">{errors.otpCode}</span> : null}
            </label>

            {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : null}

            <UIButton type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              {busy ? "Verifying..." : "Verify and Sign In"}
            </UIButton>

            <p className="hint-text" style={{ textAlign: "center", marginTop: "0.25rem" }}>
              Need a new code?{" "}
              <Link href="/admin/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
                Go back to admin sign in
              </Link>
            </p>
          </form>
        </UICardBody>
      </UICard>
    </div>
  );
}
