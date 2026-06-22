import { NextRequest, NextResponse } from "next/server";
import { buildAutoReply } from "@/lib/email-template";
import { getContactRecipient, sendAutoReply, sendMail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const email: string = body.email.trim();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const recipient = getContactRecipient();

    await Promise.all([
      // Admin notification
      sendMail({
        to: recipient,
        subject: `Newsletter Subscription — ${email}`,
        text: `New newsletter subscription:\n\nEmail: ${email}`,
        html: buildNewsletterAdminEmail(email),
      }),
      // Subscriber confirmation
      sendAutoReply({
        to: email,
        subject: "You're subscribed to Letting Partners updates",
        html: buildAutoReply(email.split("@")[0] || "there", "newsletter"),
        text: `Thank you for subscribing!\n\nYou'll receive property updates and news from Letting Partners.\n\nTo unsubscribe, reply to this email.\n\nWarm regards,\nThe Letting Partners Team`,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[newsletter route]", err);
    return NextResponse.json({ error: "Failed to subscribe. Please try again later." }, { status: 500 });
  }
}

function buildNewsletterAdminEmail(email: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#f7f9fc;border-radius:8px;padding:32px;">
      <h2 style="color:#1C3144;margin:0 0 16px;">New Newsletter Subscription</h2>
      <p style="font-size:14px;color:#555;margin:0 0 8px;">A new user has subscribed via lettingpartners.co.uk:</p>
      <p style="font-size:16px;font-weight:bold;color:#1C3144;"><a href="mailto:${email}" style="color:#1C3144;">${email}</a></p>
    </div>
  `;
}
