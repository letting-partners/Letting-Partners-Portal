import { NextRequest, NextResponse } from "next/server";
import { buildAutoReply, buildLegalAdminEmail } from "@/lib/email-template";
import { getContactRecipient, sendAutoReply, sendMail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.name || !body.email || !body.phone || !body.message) {
      return NextResponse.json({ error: "Name, email, phone, and description are required." }, { status: 400 });
    }

    const recipient = getContactRecipient();
    const subject = `Legal Support Request — ${body.name}${body.supportType ? ` (${body.supportType})` : ""}`;

    const text = [
      `Name: ${body.name}`,
      `Email: ${body.email}`,
      `Phone: ${body.phone}`,
      body.role ? `Role: ${body.role}` : null,
      body.supportType ? `Support Type: ${body.supportType}` : null,
      ``,
      `Description:`,
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
        html: buildLegalAdminEmail(body),
        replyTo: body.email,
      }),
      // Customer auto-reply
      sendAutoReply({
        to: body.email,
        subject: "We've received your legal support request — Letting Partners",
        html: buildAutoReply(body.name, "legal"),
        text: `Hi ${body.name},\n\nThank you for reaching out. Our specialist legal support team will review your request and contact you within 24 hours.\n\nCall us: 07782 273674\nEmail: info@lettingpartners.co.uk\n\nWarm regards,\nThe Letting Partners Team`,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[legal-support route]", err);
    return NextResponse.json({ error: "Failed to submit request. Please try again later." }, { status: 500 });
  }
}
