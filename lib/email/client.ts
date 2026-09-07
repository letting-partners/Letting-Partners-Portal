import "server-only";
import { Resend } from "resend";
import { serverEnv, isProduction } from "@/lib/env";

/**
 * Email delivery. In development without a Resend key, messages are logged to
 * the server console instead of being sent, so the OTP flow stays usable
 * offline. In production a missing key is a hard error - silently dropping a
 * login code would lock everyone out with no signal.
 */

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult = { ok: true; id: string | null } | { ok: false; error: string };

let cachedClient: Resend | null = null;

function getClient(apiKey: string): Resend {
  if (!cachedClient) cachedClient = new Resend(apiKey);
  return cachedClient;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const env = serverEnv();

  if (!env.RESEND_API_KEY) {
    if (isProduction) {
      return { ok: false, error: "RESEND_API_KEY is not configured." };
    }
    console.info(
      [
        "",
        "--- EMAIL (development, not sent) -------------------------------",
        `To:      ${Array.isArray(input.to) ? input.to.join(", ") : input.to}`,
        `Subject: ${input.subject}`,
        "",
        input.text,
        "-----------------------------------------------------------------",
        "",
      ].join("\n"),
    );
    return { ok: true, id: null };
  }

  try {
    const result = await getClient(env.RESEND_API_KEY).emails.send({
      from: env.AUTH_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return { ok: false, error: "Email provider rejected the message." };
    }

    return { ok: true, id: result.data?.id ?? null };
  } catch (error) {
    console.error("Email send failed:", error);
    return { ok: false, error: "Unable to send email." };
  }
}
