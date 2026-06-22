"use client";

import { FormEvent, useState } from "react";
import LPIcon from "@/components/LPIcon";

type FormState = {
  name: string;
  email: string;
  phone: string;
  enquiry: string;
  message: string;
};

const ENQUIRY_TYPES = [
  "General Enquiry",
  "Property Letting",
  "Property Management",
  "Find a Tenant",
  "Rent to Rent",
  "Tenant Registration",
  "Specialist Legal Support",
  "Other Services",
];

export default function HomeContactForm() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    enquiry: "",
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
      const res = await fetch("/api/contact", {
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
        <h3>Enquiry received</h3>
        <p>Thank you for reaching out. Letting Partners will be in touch shortly.</p>
      </div>
    );
  }

  return (
    <form className="lp-contact-form" onSubmit={handleSubmit} noValidate>
      <div className="lp-form-row lp-form-row--two">
        <div className="lp-form-group">
          <label htmlFor="cf-name" className="lp-form-label">Full name *</label>
          <input
            id="cf-name"
            type="text"
            className="lp-form-input"
            placeholder="John Smith"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
            disabled={status === "loading"}
          />
        </div>
        <div className="lp-form-group">
          <label htmlFor="cf-email" className="lp-form-label">Email address *</label>
          <input
            id="cf-email"
            type="email"
            className="lp-form-input"
            placeholder="john@example.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            required
            disabled={status === "loading"}
          />
        </div>
      </div>

      <div className="lp-form-row lp-form-row--two">
        <div className="lp-form-group">
          <label htmlFor="cf-phone" className="lp-form-label">Phone number</label>
          <input
            id="cf-phone"
            type="tel"
            className="lp-form-input"
            placeholder="07700 000000"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            disabled={status === "loading"}
          />
        </div>
        <div className="lp-form-group">
          <label htmlFor="cf-enquiry" className="lp-form-label">Enquiry type</label>
          <select
            id="cf-enquiry"
            className="lp-form-input lp-form-select"
            value={form.enquiry}
            onChange={(e) => update("enquiry", e.target.value)}
            disabled={status === "loading"}
          >
            <option value="">Select an option</option>
            {ENQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="lp-form-group">
        <label htmlFor="cf-message" className="lp-form-label">Your message *</label>
        <textarea
          id="cf-message"
          className="lp-form-input lp-form-textarea"
          placeholder="Tell us how we can help..."
          rows={5}
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          required
          disabled={status === "loading"}
        />
      </div>

      {status === "error" && (
        <p className="lp-form-error" role="alert">
          <LPIcon name="alert" size={18} /> {errorMsg}
        </p>
      )}

      <button type="submit" className="lp-btn lp-btn--gold" disabled={status === "loading"}>
        {status === "loading" ? (
          <><span className="lp-spinner" aria-hidden="true" /> Sending...</>
        ) : (
          <>Send Enquiry <LPIcon name="arrow-right" size={18} /></>
        )}
      </button>
    </form>
  );
}
