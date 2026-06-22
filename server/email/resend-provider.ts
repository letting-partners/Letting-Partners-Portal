import "server-only";
import { env } from "@/lib/env";
import type { EmailMessage, EmailProvider } from "./provider";

type ResendSendResponse = {
  id?: string;
  error?: {
    message?: string;
  };
};

export class ResendEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (response.ok) {
      return;
    }

    let details: ResendSendResponse | null = null;
    try {
      details = (await response.json()) as ResendSendResponse;
    } catch {
      details = null;
    }

    const reason =
      details?.error?.message ??
      `Resend API request failed with status ${response.status}`;

    throw new Error(reason);
  }
}
