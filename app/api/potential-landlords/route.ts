import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/requireUser";
import { createFollowUpLead, reserveFollowUpLock } from "@/server/portal/workflows";
import { normalizePhone } from "@/server/portal/normalize";

const prisma = db as any;

function mapLead(lead: any, currentUserId: string) {
  const lockedUntil = lead.followUpLockedUntil ?? null;
  const isLocked =
    Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now() && lead.addedByAgentId !== currentUserId);
  const canContinue = lead.addedByAgentId === currentUserId || !isLocked;

  return {
    id: lead.id,
    fullName: lead.fullName,
    phone: lead.phone,
    phoneLast10: lead.phoneLast10,
    phoneE164: lead.phoneE164,
    email: lead.email,
    notes: lead.notes,
    addedByAgentId: lead.addedByAgentId,
    followUpScheduledAt: lead.followUpScheduledAt,
    followUpLockedUntil: lockedUntil,
    followUpContinuedAt: lead.followUpContinuedAt,
    followUpContinuedByUserId: lead.followUpContinuedByUserId,
    isFollowUpLocked: lead.isFollowUpLocked || isLocked,
    canContinue,
    addedByAgent: lead.addedByAgent,
    followUpContinuedBy: lead.followUpContinuedBy,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() ?? url.searchParams.get("leadId")?.trim() ?? "";
  const phone = url.searchParams.get("phone")?.trim() ?? "";
  const onlyMine = auth.user.role !== "ADMIN";

  if (id) {
    const lead = await prisma.potentialLandlord.findUnique({
      where: { id },
      include: {
        addedByAgent: {
          select: { id: true, agentDisplayName: true, email: true },
        },
        followUpContinuedBy: {
          select: { id: true, agentDisplayName: true, email: true },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ lead: null }, { status: 404 });
    }

    return NextResponse.json({ lead: mapLead(lead, auth.user.id) });
  }

  const normalizedPhone = phone ? normalizePhone(phone) : null;
  const leads = await prisma.potentialLandlord.findMany({
    where: {
      ...(onlyMine ? { addedByAgentId: auth.user.id } : {}),
      ...(phone
        ? {
            phoneLast10:
              normalizedPhone && normalizedPhone.ok
                ? normalizedPhone.phoneLast10
                : phone.replace(/\D/g, "").slice(-10),
          }
        : {}),
    },
    include: {
      addedByAgent: {
        select: { id: true, agentDisplayName: true, email: true },
      },
      followUpContinuedBy: {
        select: { id: true, agentDisplayName: true, email: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return NextResponse.json({
    leads: leads.map((lead: any) => mapLead(lead, auth.user.id)),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const leadId = body.leadId ?? body.continueLeadId ?? null;

  if (leadId) {
    const existing = await prisma.potentialLandlord.findUnique({
      where: { id: leadId },
    });

    if (!existing) {
      return NextResponse.json({ error: "LEAD_NOT_FOUND" }, { status: 404 });
    }

    const { lockedUntil } = reserveFollowUpLock(existing.followUpScheduledAt ?? new Date());
    const lead = await prisma.potentialLandlord.update({
      where: { id: leadId },
      data: {
        followUpContinuedAt: new Date(),
        followUpContinuedByUserId: auth.user.id,
        isFollowUpLocked: true,
        followUpLockedUntil: existing.followUpLockedUntil ?? lockedUntil,
      },
    });

    return NextResponse.json({
      lead,
      continued: true,
    });
  }

  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const phoneNo = String(body?.phoneNo ?? body?.phone ?? "").trim();
  const scheduledAt = body?.scheduledAt ?? body?.followUpAt;

  if (!firstName || !lastName || !phoneNo || !scheduledAt) {
    return NextResponse.json(
      { error: "FIRST_NAME_LAST_NAME_PHONE_SCHEDULED_AT_REQUIRED" },
      { status: 400 },
    );
  }

  try {
    const result = await createFollowUpLead({
      agentId: auth.user.id,
      firstName,
      lastName,
      phoneNo,
      email: body?.email ? String(body.email).trim() : null,
      notes: body?.notes ? String(body.notes).trim() : null,
      scheduledAt: scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt),
    });

    return NextResponse.json({
      lead: result.lead,
      lock: result.lock,
      continued: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FOLLOW_UP_CREATE_FAILED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
