import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import {
  createFollowUpLead,
  createWorkflowCallLog,
  autoAddDialerContact,
} from "@/server/portal/workflows";
import { normalizeNamePart } from "@/server/portal/normalize";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const scheduledAt = body.scheduledAt ? String(body.scheduledAt) : null;

  if (!firstName) return NextResponse.json({ error: "FIRST_NAME_REQUIRED" }, { status: 400 });
  if (!lastName) return NextResponse.json({ error: "LAST_NAME_REQUIRED" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "PHONE_REQUIRED" }, { status: 400 });
  if (!scheduledAt) return NextResponse.json({ error: "SCHEDULED_AT_REQUIRED" }, { status: 400 });

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    return NextResponse.json({ error: "SCHEDULED_AT_MUST_BE_FUTURE" }, { status: 400 });
  }

  try {
    const { lead, lock } = await createFollowUpLead({
      agentId: auth.user.id,
      firstName,
      lastName,
      phoneNo: phone,
      email: body.email ?? null,
      scheduledAt,
    });

    const fullName = `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`.trim();

    await createWorkflowCallLog({
      agentId: auth.user.id,
      phoneNo: phone,
      outcome: "FOLLOW_UP",
      landlordName: fullName,
      potentialLandlordId: lead.id,
      scheduledFollowUpAt: scheduledDate,
    });

    await autoAddDialerContact({
      ownerUserId: auth.user.id,
      fullName,
      phoneNumber: phone,
      sourceType: "FOLLOWUP_LANDLORD",
      sourceLandlordId: lead.id,
    }).catch(() => {/* non-fatal */});

    return NextResponse.json({ ok: true, lead, lock });
  } catch (err) {
    const message = err instanceof Error ? err.message : "FOLLOW_UP_FAILED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
