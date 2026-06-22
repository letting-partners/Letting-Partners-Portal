import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import { db } from "@/server/db";
import { createWorkflowCallLog, autoAddDialerContact } from "@/server/portal/workflows";

export async function POST(
  request: NextRequest,
  { params }: { params: { landlordId: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));

  const lead = await (db as any).potentialLandlord.findUnique({
    where: { id: params.landlordId },
    select: { id: true, addedByAgentId: true, fullName: true, phone: true },
  });

  if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (lead.addedByAgentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await createWorkflowCallLog({
    agentId: auth.user.id,
    phoneNo: lead.phone,
    outcome: "NOT_INTERESTED",
    landlordName: lead.fullName,
    notes: body.notes ?? null,
    potentialLandlordId: lead.id,
  });

  await autoAddDialerContact({
    ownerUserId: auth.user.id,
    fullName: lead.fullName,
    phoneNumber: lead.phone,
    sourceType: "NOT_INTERESTED_LANDLORD" as any,
    sourceLandlordId: null,
  }).catch(() => {});

  await (db as any).potentialLandlord.delete({
    where: { id: params.landlordId },
  });

  return NextResponse.json({ ok: true });
}
