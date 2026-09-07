"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { FormError, SubmitButton } from "@/components/ui/form";
import {
  requestCodeAction,
  verifyCodeAction,
  type RequestCodeState,
  type VerifyCodeState,
} from "./actions";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

const initialRequestState: RequestCodeState = { status: "idle", email: "", message: null };
const initialVerifyState: VerifyCodeState = { status: "idle", message: null };

export default function LoginForm() {
  const [requestState, submitEmail] = useActionState(requestCodeAction, initialRequestState);

  if (requestState.status === "sent") {
    return <CodeStep email={requestState.email} />;
  }

  return (
    <form action={submitEmail} className="stack">
      <div>
        <h2>Sign in</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          Enter your work email address and we will send you a single-use code.
        </p>
      </div>

      <FormError message={requestState.status === "error" ? requestState.message : null} />

      <div className="field">
        <label className="field-label" htmlFor="email">
          Email address
        </label>
        <div className="input-group">
          <Mail size={15} aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@lettingpartners.co.uk"
            defaultValue={requestState.email}
          />
        </div>
      </div>

      <SubmitButton block size="lg" pendingLabel="Sending code...">
        Continue
        <ArrowRight size={16} />
      </SubmitButton>

      <p className="subtle" style={{ fontSize: "0.75rem", textAlign: "center" }}>
        Access is limited to accounts created by an administrator.
      </p>
    </form>
  );
}

function CodeStep({ email }: { email: string }) {
  const [verifyState, submitCode] = useActionState(verifyCodeAction, initialVerifyState);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Resend is throttled in the UI as well as on the server, so the button
  // does not invite a request that the rate limiter will reject.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const code = digits.join("");

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    setDigits((current) => {
      const next = [...current];
      if (clean.length > 1) {
        // Handles a pasted code landing in one box.
        clean.split("").forEach((char, offset) => {
          if (index + offset < OTP_LENGTH) next[index + offset] = char;
        });
      } else {
        next[index] = clean;
      }
      return next;
    });

    if (clean.length > 0) {
      const target = Math.min(index + clean.length, OTP_LENGTH - 1);
      inputsRef.current[target]?.focus();
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  }

  return (
    <div className="stack">
      <form action={submitCode} className="stack">
        <div>
          <h2>Enter your code</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            We sent a 6 digit code to <strong>{email}</strong>. It expires in 10 minutes.
          </p>
        </div>

        <FormError message={verifyState.message} />

        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={code} />

        <div className="otp-inputs" role="group" aria-label="Verification code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputsRef.current[index] = element;
              }}
              className="otp-input"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={OTP_LENGTH}
              value={digit}
              aria-label={`Digit ${index + 1}`}
              onChange={(event) => setDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
            />
          ))}
        </div>

        <label className="checkbox-row">
          <input type="checkbox" name="remember" />
          Keep me signed in on this device
        </label>

        <SubmitButton block size="lg" disabled={code.length !== OTP_LENGTH} pendingLabel="Verifying...">
          Verify and sign in
        </SubmitButton>
      </form>

      <div className="row row--between">
        <a className="btn btn--ghost btn--sm" href="/login">
          <ArrowLeft size={14} />
          Use a different email
        </a>
        <ResendButton email={email} cooldown={cooldown} onSent={() => setCooldown(RESEND_COOLDOWN_SECONDS)} />
      </div>
    </div>
  );
}

function ResendButton({
  email,
  cooldown,
  onSent,
}: {
  email: string;
  cooldown: number;
  onSent: () => void;
}) {
  const [, resend] = useActionState(requestCodeAction, initialRequestState);

  return (
    <form
      action={(formData) => {
        resend(formData);
        onSent();
      }}
    >
      <input type="hidden" name="email" value={email} />
      <button type="submit" className="btn btn--ghost btn--sm" disabled={cooldown > 0}>
        {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
      </button>
    </form>
  );
}
