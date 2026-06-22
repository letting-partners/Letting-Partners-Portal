import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import { db } from "@/server/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { landlordId: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body?.scheduledAt) {
    return NextResponse.json({ error: "SCHEDULED_AT_REQUIRED" }, { status: 400 });
  }

  const scheduledAt = new Date(body.scheduledAt);
  if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    return NextResponse.json({ error: "SCHEDULED_AT_MUST_BE_FUTURE" }, { status: 400 });
  }

  const lead = await (db as any).potentialLandlord.findUnique({
    where: { id: params.landlordId },
    select: { id: true, addedByAgentId: true },
  });

  if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (lead.addedByAgentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const lockedUntil = new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000);

  await (db as any).potentialLandlord.update({
    where: { id: params.landlordId },
    data: {
      followUpScheduledAt: scheduledAt,
      followUpLockedUntil: lockedUntil,
      isFollowUpLocked: true,
      email1hSent: false,
      email5minSent: false,
      notifSent: false,
    },
  });

  return NextResponse.json({ ok: true, followUpScheduledAt: scheduledAt.toISOString() });
}
