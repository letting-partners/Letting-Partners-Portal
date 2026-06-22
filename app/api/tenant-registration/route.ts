import { NextRequest, NextResponse } from "next/server";
import { buildAutoReply, buildTenantAdminEmail } from "@/lib/email-template";
import { getTenantRegistrationRecipient, sendAutoReply, sendMail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.name || !body.email || !body.phone) {
      return NextResponse.json({ error: "Name, email, and phone are required." }, { status: 400 });
    }

    const recipient = getTenantRegistrationRecipient();
    const subject = `Tenant Registration — ${body.name}`;

    const text = [
      `Name: ${body.name}`,
      `Email: ${body.email}`,
      `Phone: ${body.phone}`,
      body.preferredArea ? `Preferred Area: ${body.preferredArea}` : null,
      body.propertyType ? `Property Type: ${body.propertyType}` : null,
      body.maxBudget ? `Max Budget: £${body.maxBudget} pcm` : null,
      body.moveDate ? `Preferred Move Date: ${body.moveDate}` : null,
      body.message ? `\nAdditional Requirements:\n${body.message}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await Promise.all([
      // Admin notification
      sendMail({
        to: recipient,
        subject,
        text,
        html: buildTenantAdminEmail(body),
        replyTo: body.email,
      }),
      // Customer auto-reply
      sendAutoReply({
        to: body.email,
        subject: "Your tenant registration is confirmed — Letting Partners",
        html: buildAutoReply(body.name, "tenant"),
        text: `Hi ${body.name},\n\nThank you for registering with Letting Partners. We'll match your requirements to suitable properties and get back to you within 24 hours.\n\nCall us: 07782 273674\nEmail: info@lettingpartners.co.uk\n\nWarm regards,\nThe Letting Partners Team`,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tenant-registration route]", err);
    return NextResponse.json({ error: "Failed to submit registration. Please try again later." }, { status: 500 });
  }
}
