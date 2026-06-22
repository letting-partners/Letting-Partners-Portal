import "server-only";

type MailPayload = {
  html: string;
  replyTo?: string;
  subject: string;
  text: string;
  to: string;
  from?: string;
};

type MailConfig = {
  apiKey: string;
  from: string;
  noReplyFrom: string;
  contactRecipient: string;
  registrationRecipient: string;
};

type ResendErrorResponse = {
  error?: { message?: string };
  message?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getMailConfig(): MailConfig {
  const defaultRecipient = (process.env.MAIL_TO || "").trim();
  // FROM_EMAIL takes priority, then RESEND_FROM, then MAIL_FROM
  const from =
    (process.env.FROM_EMAIL || process.env.RESEND_FROM || process.env.MAIL_FROM || "").trim();
  // NOREPLY_EMAIL for auto-reply sender, falls back to FROM_EMAIL
  const noReplyFrom =
    (process.env.NOREPLY_EMAIL || from).trim() || getRequiredEnv("FROM_EMAIL");

  return {
    apiKey: getRequiredEnv("RESEND_API_KEY"),
    from: from || getRequiredEnv("FROM_EMAIL"),
    noReplyFrom,
    contactRecipient:
      (process.env.CONTACT_FORM_TO || defaultRecipient).trim() ||
      getRequiredEnv("MAIL_TO"),
    registrationRecipient:
      (process.env.TENANT_REGISTRATION_TO || defaultRecipient).trim() ||
      getRequiredEnv("MAIL_TO"),
  };
}

export function getContactRecipient() { return getMailConfig().contactRecipient; }
export function getTenantRegistrationRecipient() { return getMailConfig().registrationRecipient; }

async function resendSend(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
}, apiKey: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (response.ok) return;

  const errorPayload = (await response.json().catch(() => null)) as ResendErrorResponse | null;
  const resendError = errorPayload?.error?.message || errorPayload?.message;
  throw new Error(resendError || `Email send failed with status ${response.status}.`);
}

export async function sendMail(payload: MailPayload) {
  const config = getMailConfig();
  await resendSend(
    {
      from: payload.from ?? config.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: payload.replyTo,
    },
    config.apiKey,
  );
}

export async function sendAutoReply(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const config = getMailConfig();
  await resendSend(
    {
      from: config.noReplyFrom,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    },
    config.apiKey,
  );
}
