import { NextRequest, NextResponse } from "next/server";
import { buildAutoReply, buildContactAdminEmail } from "@/lib/email-template";
import { getContactRecipient, sendAutoReply, sendMail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.name || !body.email || !body.message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    const recipient = getContactRecipient();
    const subject = `Contact Enquiry from ${body.name}${body.enquiry ? ` — ${body.enquiry}` : ""}`;

    const text = [
      `Name: ${body.name}`,
      `Email: ${body.email}`,
      body.phone ? `Phone: ${body.phone}` : null,
      body.enquiry ? `Enquiry Type: ${body.enquiry}` : null,
      ``,
      `Message:`,
      body.message,
    ]
      .filter(Boolean)
      .join("\n");

    await Promise.all([
      // Admin notification
      sendMail({
        to: recipient,
        subject,
        text,
        html: buildContactAdminEmail(body),
        replyTo: body.email,
      }),
      // Customer auto-reply
      sendAutoReply({
        to: body.email,
        subject: "We've received your enquiry — Letting Partners",
        html: buildAutoReply(body.name, "contact"),
        text: `Hi ${body.name},\n\nThank you for getting in touch. We've received your message and will be back to you within 24 hours.\n\nCall us: 07782 273674\nEmail: info@lettingpartners.co.uk\n\nWarm regards,\nThe Letting Partners Team`,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact route]", err);
    return NextResponse.json({ error: "Failed to send message. Please try again later." }, { status: 500 });
  }
}
