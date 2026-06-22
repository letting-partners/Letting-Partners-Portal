type NumberSearchedTemplateInput = {
  ownerAgentName: string;
  searchingAgentName: string;
  landlordName: string;
  landlordPhone: string;
};

export function buildNumberSearchedTemplate(input: NumberSearchedTemplateInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Your landlord number was searched — Letting Partners";

  const text = [
    `Hi ${input.ownerAgentName},`,
    "",
    `Agent "${input.searchingAgentName}" just searched for a number that belongs to your landlord:`,
    "",
    `  Landlord: ${input.landlordName}`,
    `  Phone:    ${input.landlordPhone}`,
    "",
    "This is an automatic alert to let you know someone checked this number.",
    "No action is required unless you believe this is unusual.",
    "",
    "— Letting Partners Portal",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#080810;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080810;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:10px;overflow:hidden;border:1px solid #2a2a3a;">
          <tr>
            <td style="background:#c69a4b;padding:18px 32px;">
              <span style="font-size:18px;font-weight:700;color:#080810;letter-spacing:0.5px;">Letting Partners Portal</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#f0ead8;">Hi <strong>${input.ownerAgentName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:14px;color:#8a7e68;">An agent has searched for a phone number belonging to your landlord.</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a24;border-radius:8px;border:1px solid #2a2a3a;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a7e68;">Searched By</p>
                    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#c69a4b;">${input.searchingAgentName}</p>
                    <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a7e68;">Your Landlord</p>
                    <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#f0ead8;">${input.landlordName}</p>
                    <p style="margin:0;font-size:13px;color:#8a7e68;">${input.landlordPhone}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#8a7e68;">This is an automatic alert. No action is required unless this seems unusual.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #2a2a3a;">
              <p style="margin:0;font-size:12px;color:#8a7e68;text-align:center;">Letting Partners Portal — Automated Notification</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return { subject, text, html };
}
