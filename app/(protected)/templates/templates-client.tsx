"use client";

import { useState } from "react";
import { UIInput } from "@/components/ui/input";

type Template = {
  id: string;
  title: string;
  body: (vars: Record<string, string>) => string;
  extraVars?: { key: string; label: string; placeholder: string }[];
};

const TEMPLATES: Template[] = [
  {
    id: "welcome",
    title: "Welcome Message",
    body: ({ clientName, agentName }) => `Dear ${clientName || "[Client Name]"},

I hope you're doing well!

At Letting Partners, we're dedicated to elevating the Rental Experience for Landlords and Tenants Alike. Whether you're looking for shared or individual accommodation, we offer tailored options to suit your lifestyle and preferences.

Thank you for choosing Letting Partners. We're excited to help you find your ideal home!

Best regards,
${agentName} (Property Letting Expert)
Letting Partners
🌐 www.lettingpartners.co.uk
📞 0203 355 1412
📍 31 Pepper Street, Canary Wharf, London`,
  },
  {
    id: "enquiry",
    title: "Tenant Enquiry Form",
    body: ({ clientName, agentName }) => `Dear ${clientName || "[Client Name]"},

Thank you for your interest in Letting Partners! To help us find the ideal accommodation for you, we'd love to get some more details. Could you kindly provide the following information?

Full Name:
Email Address:
Accommodation Type: (Separate/Shared)
Room Type: (e.g., single, double, etc.)
Number of Occupants: (Single/Couple)
Number of Children:
On DSS: (Yes/No)
Age:
Gender:
Country Of Origin:
Nationality:
Currently Employed: (Yes/No)
Annual Income:
Current Living Postcode:
Workplace Postcode:
Maximum Budget:
Working Profession:
Move-In Date:

This information will help us tailor our search and offer you the best accommodation options. Looking forward to assisting you!

Best regards,
${agentName} (Property Letting Expert)
Letting Partners
📍 31 Pepper Street, Canary Wharf, London
📞 0203 355 1412
🌐 www.lettingpartners.co.uk`,
  },
  {
    id: "viewing",
    title: "Viewing Confirmation",
    extraVars: [
      { key: "viewingDateTime", label: "Date & Time", placeholder: "e.g. 31-01-2026 at 5:00 pm" },
      { key: "propertyAddress", label: "Property Address", placeholder: "e.g. 297 Preston Road, Harrow, HA3 0QQ" },
    ],
    body: ({ clientName, agentName, viewingDateTime, propertyAddress }) => `Hi ${clientName || "[Client Name]"},

This is to confirm your viewing appointment for the property.

Viewing Details:

Date & Time: ${viewingDateTime || "[Date & Time]"}

Property Address: ${propertyAddress || "[Property Address]"}

Best regards,
${agentName}
Property Letting Expert
Letting Partners
📞 0203 355 1412
🌐 www.lettingpartners.co.uk`,
  },
  {
    id: "documents",
    title: "Document Request",
    body: ({ clientName, agentName }) => `Dear ${clientName || "[Client Name]"},

Please provide the following information via email at info@lettingpartners.co.uk at your earliest convenience.

• National Insurance Number (NI)
• Passport
• eVisa
• Right to Rent Share Code
• Last Three Months' Bank Statements
• Last Three Months' Payslips
• Job Offer Letter / University Offer Letter

These documents are essential for us to complete the verification process and ensure a smooth tenancy agreement. Please let us know if you need assistance or have any questions about the requested information.

Thank you for your cooperation.

Best regards,
${agentName}
Property Letting Expert
Letting Partners
📞 0203 355 1412
🌐 www.lettingpartners.co.uk`,
  },
];

type Props = {
  agentName: string;
};

export function TemplatesClient({ agentName }: Props) {
  const [clientName, setClientName] = useState("");
  const [extraVars, setExtraVars] = useState<Record<string, Record<string, string>>>({});
  const [copied, setCopied] = useState<string | null>(null);

  function getVars(template: Template): Record<string, string> {
    return {
      clientName,
      agentName,
      ...(extraVars[template.id] ?? {}),
    };
  }

  async function handleCopy(template: Template) {
    const text = template.body(getVars(template));
    await navigator.clipboard.writeText(text);
    setCopied(template.id);
    setTimeout(() => setCopied(null), 2000);
  }

  function setExtraVar(templateId: string, key: string, value: string) {
    setExtraVars((prev) => ({
      ...prev,
      [templateId]: { ...(prev[templateId] ?? {}), [key]: value },
    }));
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Message Templates</h1>
          <p className="page-subtitle">Fill in the client name, then copy any template to send.</p>
        </div>
      </header>

      {/* Global client name field */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <label className="field" style={{ maxWidth: "360px" }}>
          <span className="label" style={{ fontWeight: 700 }}>
            Client Name <span style={{ color: "var(--danger)" }}>*</span>
          </span>
          <UIInput
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. Iris, Christina, John..."
            autoFocus
          />
          <span className="hint-text">Applied to all templates automatically.</span>
        </label>
      </div>

      {/* Template cards */}
      {TEMPLATES.map((template) => {
        const vars = getVars(template);
        const preview = template.body(vars);
        const isCopied = copied === template.id;

        return (
          <div key={template.id} className="panel">
            <div style={{
              padding: "0.9rem 1.25rem",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}>
              <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>
                {template.title}
              </h2>
              <button
                onClick={() => void handleCopy(template)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 1rem",
                  borderRadius: "0.4rem",
                  border: `1px solid ${isCopied ? "var(--success, #4ade80)" : "var(--brand-gold)"}`,
                  background: isCopied ? "rgba(74,222,128,0.08)" : "transparent",
                  color: isCopied ? "var(--success, #4ade80)" : "var(--brand-gold)",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {isCopied ? (
                  <>
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "1em", height: "1em" }}>
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "1em", height: "1em" }}>
                      <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                      <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>

            <div style={{ padding: "1.25rem" }}>
              {/* Extra vars (e.g. viewing date/address) */}
              {template.extraVars && template.extraVars.length > 0 && (
                <div className="field-grid-2" style={{ marginBottom: "1rem" }}>
                  {template.extraVars.map((v) => (
                    <label key={v.key} className="field">
                      <span className="label">{v.label}</span>
                      <UIInput
                        value={extraVars[template.id]?.[v.key] ?? ""}
                        onChange={(e) => setExtraVar(template.id, v.key, e.target.value)}
                        placeholder={v.placeholder}
                      />
                    </label>
                  ))}
                </div>
              )}

              {/* Message preview */}
              <pre style={{
                margin: 0,
                fontFamily: "inherit",
                fontSize: "0.82rem",
                lineHeight: 1.7,
                color: "var(--text-muted)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "var(--surface-alt, #1a1a24)",
                borderRadius: "0.5rem",
                padding: "1rem 1.25rem",
                border: "1px solid var(--border)",
              }}>
                {preview}
              </pre>
            </div>
          </div>
        );
      })}
    </div>
  );
}
