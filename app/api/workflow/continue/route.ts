import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import { db } from "@/server/db";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });

  const potentialId = String(body.potentialId ?? "").trim();
  if (!potentialId) return NextResponse.json({ error: "POTENTIAL_ID_REQUIRED" }, { status: 400 });

  const lead = await (db as any).potentialLandlord.findUnique({
    where: { id: potentialId },
    select: {
      id: true,
      addedByAgentId: true,
      fullName: true,
      phone: true,
      phoneLast10: true,
      followUpScheduledAt: true,
      followUpLockedUntil: true,
      isFollowUpLocked: true,
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const now = new Date();
  const isLocked = lead.isFollowUpLocked && lead.followUpLockedUntil && lead.followUpLockedUntil > now;
  const isOwner = lead.addedByAgentId === auth.user.id;

  if (isLocked && !isOwner) {
    return NextResponse.json(
      {
        error: "LOCKED",
        message: "This landlord is locked by another agent.",
        lockedUntil: lead.followUpLockedUntil,
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    lead: {
      id: lead.id,
      fullName: lead.fullName,
      phone: lead.phone,
      phoneLast10: lead.phoneLast10,
      followUpScheduledAt: lead.followUpScheduledAt,
      followUpLockedUntil: lead.followUpLockedUntil,
    },
  });
}
