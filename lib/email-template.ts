import "server-only";

const SITE_URL = "https://www.lettingpartners.co.uk";
const LOGO_URL = `${SITE_URL}/lp-logo.webp`;
const BRAND_NAVY = "#1C3144";
const BRAND_GOLD = "#B8963E";

function emailShell(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
    <tr><td>
      <table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_NAVY};padding:28px 32px;text-align:center;">
            <a href="${SITE_URL}" style="display:inline-block;">
              <img src="${LOGO_URL}" alt="Letting Partners" width="160" height="44" style="display:block;border:0;" />
            </a>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            ${bodyContent}
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e8ecf0;margin:0;"></td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7f9fc;padding:20px 32px;text-align:center;border-top:3px solid ${BRAND_GOLD};">
            <p style="margin:0 0 6px;font-size:13px;color:#444;">
              <strong style="color:${BRAND_NAVY};">Letting Partners</strong> — London &amp; Birmingham, UK
            </p>
            <p style="margin:0 0 6px;font-size:13px;color:#666;">
              <a href="tel:07782273674" style="color:${BRAND_NAVY};text-decoration:none;">07782 273674</a>
              &nbsp;&bull;&nbsp;
              <a href="mailto:info@lettingpartners.co.uk" style="color:${BRAND_NAVY};text-decoration:none;">info@lettingpartners.co.uk</a>
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#aaa;">
              &copy; ${new Date().getFullYear()} Letting Partners. All rights reserved. Registered in England &amp; Wales.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function fieldRow(label: string, value: string, shade = false): string {
  const bg = shade ? "background:#f7f9fc;" : "";
  return `<tr>
    <td style="padding:10px 14px;font-weight:bold;font-size:14px;color:#333;width:180px;${bg}border-bottom:1px solid #e8ecf0;">${label}</td>
    <td style="padding:10px 14px;font-size:14px;color:#555;${bg}border-bottom:1px solid #e8ecf0;">${value}</td>
  </tr>`;
}

function sectionHeading(title: string): string {
  return `<h3 style="margin:24px 0 12px;font-size:15px;color:${BRAND_NAVY};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${title}</h3>`;
}

function messageBox(content: string): string {
  return `<div style="background:#f7f9fc;border-left:4px solid ${BRAND_GOLD};padding:16px 18px;border-radius:4px;font-size:14px;color:#444;line-height:1.6;white-space:pre-wrap;">${content}</div>`;
}

// ---------------------------------------------------------------------------
// Admin notification — contact enquiry
// ---------------------------------------------------------------------------
export function buildContactAdminEmail(body: {
  name: string;
  email: string;
  phone?: string;
  enquiry?: string;
  message: string;
}): string {
  const content = `
    <h2 style="margin:0 0 6px;font-size:20px;color:${BRAND_NAVY};">New Contact Enquiry</h2>
    <p style="margin:0 0 24px;font-size:13px;color:#888;">Received via the contact form on lettingpartners.co.uk</p>
    ${sectionHeading("Sender Details")}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ecf0;border-radius:6px;border-collapse:collapse;">
      ${fieldRow("Name", body.name)}
      ${fieldRow("Email", `<a href="mailto:${body.email}" style="color:${BRAND_NAVY};">${body.email}</a>`, true)}
      ${body.phone ? fieldRow("Phone", body.phone) : ""}
      ${body.enquiry ? fieldRow("Enquiry Type", `<span style="display:inline-block;padding:2px 10px;background:${BRAND_NAVY};color:#fff;border-radius:20px;font-size:12px;">${body.enquiry}</span>`, true) : ""}
    </table>
    ${sectionHeading("Message")}
    ${messageBox(body.message)}
  `;
  return emailShell(content);
}

// ---------------------------------------------------------------------------
// Admin notification — tenant registration
// ---------------------------------------------------------------------------
export function buildTenantAdminEmail(body: {
  name: string;
  email: string;
  phone: string;
  preferredArea?: string;
  propertyType?: string;
  maxBudget?: string;
  moveDate?: string;
  message?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 6px;font-size:20px;color:${BRAND_NAVY};">New Tenant Registration</h2>
    <p style="margin:0 0 24px;font-size:13px;color:#888;">Received via the tenant registration form on lettingpartners.co.uk</p>
    ${sectionHeading("Applicant Details")}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ecf0;border-radius:6px;border-collapse:collapse;">
      ${fieldRow("Name", body.name)}
      ${fieldRow("Email", `<a href="mailto:${body.email}" style="color:${BRAND_NAVY};">${body.email}</a>`, true)}
      ${fieldRow("Phone", body.phone)}
      ${body.preferredArea ? fieldRow("Preferred Area", body.preferredArea, true) : ""}
      ${body.propertyType ? fieldRow("Property Type", body.propertyType) : ""}
      ${body.maxBudget ? fieldRow("Max Budget", `<strong>&pound;${body.maxBudget} pcm</strong>`, true) : ""}
      ${body.moveDate ? fieldRow("Move-in Date", body.moveDate) : ""}
    </table>
    ${body.message ? `${sectionHeading("Additional Requirements")}${messageBox(body.message)}` : ""}
  `;
  return emailShell(content);
}

// ---------------------------------------------------------------------------
// Admin notification — legal support
// ---------------------------------------------------------------------------
export function buildLegalAdminEmail(body: {
  name: string;
  email: string;
  phone: string;
  role?: string;
  supportType?: string;
  message: string;
}): string {
  const content = `
    <h2 style="margin:0 0 6px;font-size:20px;color:${BRAND_NAVY};">Legal Support Request</h2>
    <p style="margin:0 0 24px;font-size:13px;color:#888;">Received via the specialist legal support form on lettingpartners.co.uk</p>
    ${sectionHeading("Applicant Details")}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ecf0;border-radius:6px;border-collapse:collapse;">
      ${fieldRow("Name", body.name)}
      ${fieldRow("Email", `<a href="mailto:${body.email}" style="color:${BRAND_NAVY};">${body.email}</a>`, true)}
      ${fieldRow("Phone", body.phone)}
      ${body.role ? fieldRow("Role", body.role, true) : ""}
      ${body.supportType ? fieldRow("Support Type", `<span style="display:inline-block;padding:2px 10px;background:${BRAND_NAVY};color:#fff;border-radius:20px;font-size:12px;">${body.supportType}</span>`) : ""}
    </table>
    ${sectionHeading("Description")}
    ${messageBox(body.message)}
  `;
  return emailShell(content);
}

// ---------------------------------------------------------------------------
// Customer auto-reply — generic (used for contact + legal)
// ---------------------------------------------------------------------------
export function buildAutoReply(name: string, formType: "contact" | "legal" | "tenant" | "newsletter"): string {
  const messages: Record<typeof formType, { headline: string; body: string }> = {
    contact: {
      headline: "Thank you for getting in touch!",
      body: "We've received your message and a member of our team will be in touch with you within <strong>24 hours</strong>.",
    },
    legal: {
      headline: "We've received your legal support request",
      body: "Thank you for reaching out. One of our specialist legal support team members will review your request and contact you within <strong>24 hours</strong>.",
    },
    tenant: {
      headline: "Your tenant registration is confirmed",
      body: "Thank you for registering with Letting Partners. We'll match your requirements to suitable properties and get back to you within <strong>24 hours</strong> with available options.",
    },
    newsletter: {
      headline: "You're subscribed!",
      body: "You're now signed up for updates from Letting Partners. We'll keep you informed about new properties, market insights, and news.",
    },
  };

  const { headline, body: msg } = messages[formType];

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;color:${BRAND_NAVY};">${headline}</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.7;">${msg}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr>
        <td style="padding:0 0 8px;">
          <p style="margin:0;font-size:14px;font-weight:bold;color:${BRAND_NAVY};">In the meantime, you can reach us directly:</p>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 0;">
          <a href="tel:07782273674" style="font-size:14px;color:${BRAND_NAVY};text-decoration:none;">&#128222; 07782 273674</a>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 0;">
          <a href="mailto:info@lettingpartners.co.uk" style="font-size:14px;color:${BRAND_NAVY};text-decoration:none;">&#9993; info@lettingpartners.co.uk</a>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 0;">
          <a href="${SITE_URL}/properties" style="font-size:14px;color:${BRAND_GOLD};text-decoration:none;">&#127968; Browse our properties</a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:#888;">Warm regards,<br><strong style="color:${BRAND_NAVY};">The Letting Partners Team</strong></p>
  `;
  return emailShell(content);
}
