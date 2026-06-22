import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/requireUser";
import { createLandlordLookupEvent } from "@/server/portal/workflows";
import { normalizePhone } from "@/server/portal/normalize";

const prisma = db as any;

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const phoneInput = url.searchParams.get("phone")?.trim() ?? "";
  if (!phoneInput) {
    return NextResponse.json({ error: "PHONE_REQUIRED" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phoneInput);
  if (!normalizedPhone.ok) {
    return NextResponse.json({ error: normalizedPhone.message }, { status: 400 });
  }

  const [landlord, activeLead] = await Promise.all([
    prisma.landlord.findUnique({
      where: { phoneLast10: normalizedPhone.phoneLast10 },
      include: {
        ownerAgent: {
          select: {
            id: true,
            agentDisplayName: true,
            email: true,
          },
        },
      },
    }),
    prisma.potentialLandlord.findFirst({
      where: {
        phoneLast10: normalizedPhone.phoneLast10,
        isFollowUpLocked: true,
        followUpLockedUntil: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        addedByAgent: {
          select: {
            id: true,
            agentDisplayName: true,
            email: true,
          },
        },
        followUpContinuedBy: {
          select: {
            id: true,
            agentDisplayName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const ownershipState = landlord
    ? landlord.ownerAgentId === auth.user.id
      ? "OWNED_BY_CURRENT_AGENT"
      : "OWNED_BY_OTHER_AGENT"
    : "UNCLAIMED";

  const isLocked = Boolean(activeLead && activeLead.addedByAgentId !== auth.user.id);
  const lockedUntil = activeLead?.followUpLockedUntil ?? null;
  const canContinue = Boolean(activeLead && activeLead.addedByAgentId === auth.user.id);

  await createLandlordLookupEvent({
    agentId: auth.user.id,
    phoneNo: phoneInput,
    phoneLast10: normalizedPhone.phoneLast10,
    phoneE164: normalizedPhone.phoneE164,
    ownershipState,
    landlordId: landlord?.id ?? null,
    potentialLandlordId: activeLead?.id ?? null,
    isLocked,
    lockedUntil,
  });

  return NextResponse.json({
    ownershipState,
    isLocked,
    lockedUntil,
    canContinue,
    landlord: landlord
      ? {
          id: landlord.id,
          landlordName: landlord.landlordName,
          landlordNumber: landlord.landlordNumber,
          phoneE164: landlord.phoneE164,
          phoneLast10: landlord.phoneLast10,
          email: landlord.email,
          ownerAgentId: landlord.ownerAgentId,
          ownerAgent: landlord.ownerAgent,
        }
      : null,
    followUpLead: activeLead
      ? {
          id: activeLead.id,
          fullName: activeLead.fullName,
          phone: activeLead.phone,
          phoneLast10: activeLead.phoneLast10,
          phoneE164: activeLead.phoneE164,
          addedByAgentId: activeLead.addedByAgentId,
          addedByAgent: activeLead.addedByAgent,
          followUpScheduledAt: activeLead.followUpScheduledAt,
          followUpLockedUntil: activeLead.followUpLockedUntil,
          followUpContinuedAt: activeLead.followUpContinuedAt,
          followUpContinuedBy: activeLead.followUpContinuedBy,
          isFollowUpLocked: activeLead.isFollowUpLocked,
        }
      : null,
  });
}