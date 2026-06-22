"use client";

import { FormEvent, useState } from "react";
import LPIcon from "@/components/LPIcon";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Subscription failed.");
      }
      setStatus("success");
      setEmail("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="lp-newsletter-success">
        <LPIcon name="check-circle" size={18} />
        <span>You are subscribed. We will be in touch.</span>
      </div>
    );
  }

  return (
    <form className="lp-newsletter-form" onSubmit={handleSubmit} noValidate>
      <input
        type="email"
        className="lp-newsletter-input"
        placeholder="Your email address"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        aria-label="Email address for newsletter"
        disabled={status === "loading"}
      />
      <button type="submit" className="lp-btn lp-btn--gold" disabled={status === "loading"}>
        {status === "loading" ? <span className="lp-spinner" aria-hidden="true" /> : "Subscribe"}
      </button>
      {status === "error" && <p className="lp-form-error">{errorMsg}</p>}
    </form>
  );
}
