import { publicEnv } from "@/lib/env";

/**
 * Transactional email templates. Table-based HTML with inline styles, because
 * that is what email clients reliably render. Brand colours mirror the public
 * Letting Partners website.
 */

const NAVY = "#071826";
const GOLD = "#c69a4b";
const CREAM = "#fbf7f0";
const TEXT = "#162431";
const MUTED = "#607180";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:${CREAM};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:${TEXT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(7,24,38,0.08);">
            <tr>
              <td style="background:${NAVY};padding:24px 32px;">
                <span style="color:${GOLD};font-size:12px;font-weight:800;letter-spacing:0.13em;text-transform:uppercase;">Letting Partners</span>
                <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:6px;">${escapeHtml(title)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid rgba(7,24,38,0.1);color:${MUTED};font-size:12px;line-height:1.6;">
                Letting Partners LTD. Registered in England and Wales. Registration No. 17436005.<br />
                This is an automated message from the staff portal.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function otpEmail(code: string, expiresInMinutes: number) {
  const html = layout(
    "Your verification code",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Use this code to sign in to the Letting Partners portal.</p>
     <div style="margin:24px 0;padding:20px;background:${CREAM};border-radius:12px;text-align:center;">
       <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:${NAVY};">${escapeHtml(code)}</div>
     </div>
     <p style="margin:0 0 8px;font-size:14px;color:${MUTED};line-height:1.6;">
       The code expires in ${expiresInMinutes} minutes and can only be used once.
     </p>
     <p style="margin:0;font-size:14px;color:${MUTED};line-height:1.6;">
       If you did not try to sign in, you can ignore this email and no action will be taken.
     </p>`,
  );

  const text = [
    "Your Letting Partners portal verification code",
    "",
    code,
    "",
    `This code expires in ${expiresInMinutes} minutes and can only be used once.`,
    "If you did not try to sign in, you can ignore this email.",
  ].join("\n");

  return { subject: `${code} is your Letting Partners verification code`, html, text };
}

export function accountCreatedEmail(fullName: string, role: string) {
  const portalUrl = publicEnv.NEXT_PUBLIC_PORTAL_URL;
  const html = layout(
    "Your portal account is ready",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(fullName)},</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
       An account has been created for you on the Letting Partners portal with the role
       <strong>${escapeHtml(role.replace(/_/g, " ").toLowerCase())}</strong>.
     </p>
     <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
       There is no password to remember. Enter your email address and we will send you a
       single-use code each time you sign in.
     </p>
     <a href="${portalUrl}" style="display:inline-block;background:${GOLD};color:${NAVY};font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none;">Open the portal</a>`,
  );

  const text = [
    `Hello ${fullName},`,
    "",
    `An account has been created for you on the Letting Partners portal (role: ${role}).`,
    "Sign in with your email address and the single-use code we send you.",
    "",
    portalUrl,
  ].join("\n");

  return { subject: "Your Letting Partners portal account is ready", html, text };
}

export function followUpReminderEmail(fullName: string, count: number) {
  const url = `${publicEnv.NEXT_PUBLIC_PORTAL_URL}/follow-ups`;
  const html = layout(
    "Follow-ups due today",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(fullName)},</p>
     <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
       You have <strong>${count}</strong> follow-up${count === 1 ? "" : "s"} due today.
     </p>
     <a href="${url}" style="display:inline-block;background:${GOLD};color:${NAVY};font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none;">View follow-ups</a>`,
  );

  const text = `Hello ${fullName},\n\nYou have ${count} follow-up(s) due today.\n\n${url}`;
  return { subject: `${count} follow-up${count === 1 ? "" : "s"} due today`, html, text };
}

export function missedCustomerChatEmail(fullName: string, propertyTitle: string | null) {
  const url = `${publicEnv.NEXT_PUBLIC_PORTAL_URL}/chats/customer`;
  const context = propertyTitle ? ` about ${escapeHtml(propertyTitle)}` : "";
  const html = layout(
    "New website enquiry",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(fullName)},</p>
     <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
       A website visitor started a chat${context} and is waiting for a reply.
     </p>
     <a href="${url}" style="display:inline-block;background:${GOLD};color:${NAVY};font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none;">Open customer chats</a>`,
  );

  const text = `Hello ${fullName},\n\nA website visitor started a chat${propertyTitle ? ` about ${propertyTitle}` : ""} and is waiting for a reply.\n\n${url}`;
  return { subject: "New website enquiry waiting for a reply", html, text };
}
