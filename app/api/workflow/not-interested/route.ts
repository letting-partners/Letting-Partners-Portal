import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import { createWorkflowCallLog, autoAddDialerContact } from "@/server/portal/workflows";
import { normalizeNamePart } from "@/server/portal/normalize";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });

  const phone = String(body.phone ?? "").trim();
  if (!phone) return NextResponse.json({ error: "PHONE_REQUIRED" }, { status: 400 });

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const fullName = [firstName, lastName]
    .map((p) => normalizeNamePart(p))
    .filter(Boolean)
    .join(" ") || String(body.landlordName ?? "").trim() || null;

  const callRecord = await createWorkflowCallLog({
    agentId: auth.user.id,
    phoneNo: phone,
    outcome: "NOT_INTERESTED",
    landlordName: fullName,
    notes: body.notes ?? null,
  });

  if (fullName) {
    await autoAddDialerContact({
      ownerUserId: auth.user.id,
      fullName,
      phoneNumber: phone,
      sourceType: "NOT_INTERESTED_LANDLORD" as any,
      sourceLandlordId: null,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, callRecord });
}
