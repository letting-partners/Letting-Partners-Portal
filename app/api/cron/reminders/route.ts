import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

// Called by Vercel Cron or external scheduler every minute.
// Requires CRON_SECRET header to prevent unauthorized access.
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const fiveMinFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  const leads = await (db as any).potentialLandlord.findMany({
    where: {
      isFollowUpLocked: true,
      followUpScheduledAt: { not: null },
      OR: [
        { email1hSent: false, followUpScheduledAt: { lte: oneHourFromNow, gte: now } },
        { email5minSent: false, followUpScheduledAt: { lte: fiveMinFromNow, gte: now } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email1hSent: true,
      email5minSent: true,
      notifSent: true,
      followUpScheduledAt: true,
      addedByAgentId: true,
      addedByAgent: { select: { email: true, agentDisplayName: true } },
    },
  });

  const results = { sent1h: 0, sent5min: 0, notifs: 0 };

  for (const lead of leads) {
    const scheduledAt = new Date(lead.followUpScheduledAt);
    const msUntil = scheduledAt.getTime() - now.getTime();
    const minutesUntil = msUntil / 1000 / 60;

    // 1-hour reminder: fire between 55 and 65 minutes before
    if (!lead.email1hSent && minutesUntil >= 55 && minutesUntil <= 65) {
      await sendReminderEmail({
        to: lead.addedByAgent.email,
        agentName: lead.addedByAgent.agentDisplayName,
        landlordName: lead.fullName,
        phone: lead.phone,
        scheduledAt,
        subject: `Follow-up reminder in 1 hour — ${lead.fullName}`,
      });
      await (db as any).potentialLandlord.update({
        where: { id: lead.id },
        data: { email1hSent: true },
      });
      results.sent1h++;
    }

    // 5-min reminder: fire between 3 and 7 minutes before
    if (!lead.email5minSent && minutesUntil >= 3 && minutesUntil <= 7) {
      await sendReminderEmail({
        to: lead.addedByAgent.email,
        agentName: lead.addedByAgent.agentDisplayName,
        landlordName: lead.fullName,
        phone: lead.phone,
        scheduledAt,
        subject: `URGENT: Follow-up in 5 minutes — ${lead.fullName}`,
      });

      if (!lead.notifSent) {
        await db.notification.create({
          data: {
            userId: lead.addedByAgentId,
            type: "FOLLOW_UP_REMINDER",
            title: `Follow-up in 5 minutes`,
            body: `Your follow-up call with ${lead.fullName} (${lead.phone}) is in 5 minutes.`,
            metadata: { potentialLandlordId: lead.id, scheduledAt: scheduledAt.toISOString() },
          },
        });
        results.notifs++;
      }

      await (db as any).potentialLandlord.update({
        where: { id: lead.id },
        data: { email5minSent: true, notifSent: true },
      });
      results.sent5min++;
    }
  }

  return NextResponse.json({ ok: true, processed: leads.length, ...results });
}

async function sendReminderEmail(params: {
  to: string;
  agentName: string;
  landlordName: string;
  phone: string;
  scheduledAt: Date;
  subject: string;
}) {
  const timeStr = params.scheduledAt.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // Use the existing email infrastructure if available, otherwise log
  try {
    const { sendEmail } = await (import("@/server/email") as any).catch(() => ({ sendEmail: null }));
    if (sendEmail) {
      await sendEmail({
        to: params.to,
        subject: params.subject,
        text: `Hi ${params.agentName},\n\nReminder: you have a follow-up scheduled with ${params.landlordName} (${params.phone}) at ${timeStr}.\n\nLog in to the Letting Partners Portal to continue.\n`,
      });
      return;
    }
  } catch {
    // email module not available
  }

  console.log(`[REMINDER EMAIL] To: ${params.to} | Subject: ${params.subject}`);
}
