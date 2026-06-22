import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import { db } from "@/server/db";
import { normalizePhone } from "@/server/portal/normalize";
import { sendNumberSearchedEmail } from "@/server/email/service";

type DbClient = typeof db & Record<string, any>;
const prisma = db as DbClient;

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });

  const rawPhone = String(body.phone ?? "").trim();
  if (!rawPhone) return NextResponse.json({ error: "PHONE_REQUIRED" }, { status: 400 });

  const phone = normalizePhone(rawPhone);
  if (!phone.ok) {
    return NextResponse.json({ error: "INVALID_PHONE", message: phone.message }, { status: 422 });
  }

  const { phoneLast10, phoneE164 } = phone;
  const agentId = auth.user.id;

  // Check Landlord table first (confirmed landlords)
  const landlord = await db.landlord.findFirst({
    where: { phoneLast10 },
    select: {
      id: true,
      landlordName: true,
      ownerAgentId: true,
      ownerAgent: { select: { email: true, agentDisplayName: true } },
    },
  });

  if (landlord) {
    const isMine = landlord.ownerAgentId === agentId;

    // Log the lookup event
    await prisma.landlordLookupEvent.create({
      data: {
        agentId,
        phoneNo: rawPhone,
        phoneLast10,
        phoneE164,
        ownershipState: isMine ? "OWNED_BY_CURRENT_AGENT" : "OWNED_BY_OTHER_AGENT",
        landlordId: landlord.id,
        isLocked: false,
      },
    });

    // Increment totalSearched in daily report
    await upsertDailySearchCount(agentId);

    if (isMine) {
      return NextResponse.json({
        state: "MINE",
        landlord: { id: landlord.id, name: landlord.landlordName },
      });
    }

    // OTHER — notify the owner agent in-app and by email
    await db.notification.create({
      data: {
        userId: landlord.ownerAgentId,
        type: "LANDLORD_LOOKUP",
        title: "Another agent looked up your landlord",
        body: `An agent searched for ${landlord.landlordName}'s number (${rawPhone}).`,
        metadata: { landlordId: landlord.id, searchingAgentId: agentId },
      },
    });

    sendNumberSearchedEmail({
      to: landlord.ownerAgent.email,
      ownerAgentName: landlord.ownerAgent.agentDisplayName,
      searchingAgentName: auth.user.agentDisplayName,
      landlordName: landlord.landlordName,
      landlordPhone: rawPhone,
    }).catch(() => {/* non-fatal */});

    return NextResponse.json({ state: "OTHER" });
  }

  // Check PotentialLandlord table
  const potential = await prisma.potentialLandlord.findFirst({
    where: { phoneLast10 },
    select: {
      id: true,
      fullName: true,
      addedByAgentId: true,
      isFollowUpLocked: true,
      followUpLockedUntil: true,
      followUpScheduledAt: true,
    },
  });

  if (potential) {
    const isMine = potential.addedByAgentId === agentId;
    const now = new Date();
    const isLocked =
      potential.isFollowUpLocked &&
      potential.followUpLockedUntil &&
      potential.followUpLockedUntil > now;

    await prisma.landlordLookupEvent.create({
      data: {
        agentId,
        phoneNo: rawPhone,
        phoneLast10,
        phoneE164,
        ownershipState: isMine ? "OWNED_BY_CURRENT_AGENT" : "OWNED_BY_OTHER_AGENT",
        potentialLandlordId: potential.id,
        isLocked: isLocked ?? false,
        lockedUntil: potential.followUpLockedUntil ?? null,
      },
    });

    await upsertDailySearchCount(agentId);

    if (isMine) {
      return NextResponse.json({
        state: "MINE_POTENTIAL",
        potential: {
          id: potential.id,
          name: potential.fullName,
          followUpScheduledAt: potential.followUpScheduledAt,
          isLocked,
        },
      });
    }

    if (isLocked) {
      await db.notification.create({
        data: {
          userId: potential.addedByAgentId,
          type: "LANDLORD_LOOKUP",
          title: "Another agent looked up your follow-up lead",
          body: `An agent searched for ${potential.fullName}'s number (${rawPhone}).`,
          metadata: { potentialLandlordId: potential.id, searchingAgentId: agentId },
        },
      });
      return NextResponse.json({ state: "OTHER" });
    }
  }

  // FREE — number not in system
  await prisma.landlordLookupEvent.create({
    data: {
      agentId,
      phoneNo: rawPhone,
      phoneLast10,
      phoneE164,
      ownershipState: "UNCLAIMED",
      isLocked: false,
    },
  });

  await upsertDailySearchCount(agentId);

  return NextResponse.json({ state: "FREE", phoneLast10, phoneE164 });
}

async function upsertDailySearchCount(agentId: string) {
  const now = new Date();
  const reportDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await (db as any).dailyReport.upsert({
    where: { agentId_reportDate: { agentId, reportDate } },
    create: { agentId, reportDate, callsMade: 0, totalSearched: 1 },
    update: { totalSearched: { increment: 1 } },
  });
}
