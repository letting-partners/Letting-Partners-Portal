"use client";

import { FormEvent, useState } from "react";
import LPIcon from "@/components/LPIcon";

const SUPPORT_TYPES = [
  "Section 8 Notice",
  "Section 21 Notice",
  "Tenancy Dispute",
  "Rent Arrears Recovery",
  "Possession Proceedings",
  "Deposit Dispute",
  "Breach of Tenancy",
  "Other Legal Matter",
];

type FormState = {
  name: string;
  email: string;
  phone: string;
  role: string;
  supportType: string;
  message: string;
};

export default function LegalSupportForm() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    role: "",
    supportType: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/legal-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="lp-form-success">
        <div className="lp-form-success-icon">
          <LPIcon name="check-circle" size={26} />
        </div>
        <h3>Request received</h3>
        <p>Thank you for reaching out. We will review your situation and connect you with the appropriate specialist promptly.</p>
      </div>
    );
  }

  return (
    <form className="lp-contact-form" onSubmit={handleSubmit} noValidate>
      <div className="lp-form-row lp-form-row--two">
        <div className="lp-form-group">
          <label htmlFor="ls-name" className="lp-form-label">Full name *</label>
          <input id="ls-name" type="text" className="lp-form-input" placeholder="Your full name" value={form.name} onChange={(e) => update("name", e.target.value)} required disabled={status === "loading"} />
        </div>
        <div className="lp-form-group">
          <label htmlFor="ls-email" className="lp-form-label">Email address *</label>
          <input id="ls-email" type="email" className="lp-form-input" placeholder="your@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} required disabled={status === "loading"} />
        </div>
      </div>

      <div className="lp-form-row lp-form-row--two">
        <div className="lp-form-group">
          <label htmlFor="ls-phone" className="lp-form-label">Phone number *</label>
          <input id="ls-phone" type="tel" className="lp-form-input" placeholder="07700 000000" value={form.phone} onChange={(e) => update("phone", e.target.value)} required disabled={status === "loading"} />
        </div>
        <div className="lp-form-group">
          <label htmlFor="ls-role" className="lp-form-label">I am a</label>
          <select id="ls-role" className="lp-form-input lp-form-select" value={form.role} onChange={(e) => update("role", e.target.value)} disabled={status === "loading"}>
            <option value="">Select role</option>
            <option value="Landlord">Landlord</option>
            <option value="Tenant">Tenant</option>
            <option value="Property Manager">Property Manager</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="lp-form-group">
        <label htmlFor="ls-type" className="lp-form-label">Type of legal support required</label>
        <select id="ls-type" className="lp-form-input lp-form-select" value={form.supportType} onChange={(e) => update("supportType", e.target.value)} disabled={status === "loading"}>
          <option value="">Select type</option>
          {SUPPORT_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="lp-form-group">
        <label htmlFor="ls-message" className="lp-form-label">Brief description of the situation *</label>
        <textarea id="ls-message" className="lp-form-input lp-form-textarea" placeholder="Please describe the issue, timeline, and any key details that will help us understand your situation..." rows={5} value={form.message} onChange={(e) => update("message", e.target.value)} required disabled={status === "loading"} />
      </div>

      {status === "error" && (
        <p className="lp-form-error" role="alert">
          <LPIcon name="alert" size={18} /> {errorMsg}
        </p>
      )}

      <button type="submit" className="lp-btn lp-btn--gold" disabled={status === "loading"}>
        {status === "loading" ? (
          <><span className="lp-spinner" aria-hidden="true" /> Submitting...</>
        ) : (
          <>Request Legal Support <LPIcon name="arrow-right" size={18} /></>
        )}
      </button>
    </form>
  );
}
