"use client";

import { FormEvent, useState } from "react";
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
};

export function VerifyOtpClient({ initialEmail = "" }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [errors, setErrors] = useState<{ email?: string; otpCode?: string }>({});

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
      { email: string; otpCode: string; portal: "agent" },
      VerifyResponse
    >("/api/auth/verify-otp", {
      email: normalizedEmail,
      otpCode: otpCode.trim(),
      portal: "agent",
    });
    setBusy(false);

    if (!result.ok) {
      if (result.error === "ADMIN_LOGIN_REQUIRED") {
        router.push(`/admin/login?email=${encodeURIComponent(normalizedEmail)}&reason=admin`);
        return;
      }

      const text =
        result.error === "OTP_INVALID"
          ? "The OTP code is incorrect."
          : result.error === "OTP_EXPIRED"
            ? "The OTP code has expired. Request a new one from the sign-in page."
            : result.error === "OTP_ATTEMPTS_EXCEEDED"
              ? "Too many incorrect OTP attempts."
              : result.error === "OTP_VERIFY_RATE_LIMIT"
                ? "Too many verification attempts. Please wait."
                : result.message ?? "Failed to verify OTP.";
      setMessage({ type: "error", text });
      return;
    }

    setMessage({ type: "success", text: "Verified. Redirecting to your dashboard..." });
    window.location.assign(result.data.redirectTo || "/dashboard");
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lp-logo.webp" alt="Letting Partners" className="auth-logo" />
        <h1 className="auth-title">Verify Your Code</h1>
        <p className="auth-subtitle">Enter the 6-digit code sent to your email address.</p>
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
                placeholder="you@agency.com"
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
              Did not receive a code?{" "}
              <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
                Go back to sign in
              </Link>
            </p>
          </form>
        </UICardBody>
      </UICard>
    </div>
  );
}
