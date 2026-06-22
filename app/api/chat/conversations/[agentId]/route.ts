import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/requireUser";
import { createWorkflowCallLog } from "@/server/portal/workflows";

const prisma = db as any;

const ALLOWED_OUTCOMES = new Set(["CONFIRMED", "FOLLOW_UP", "NOT_INTERESTED"]);

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const phone = url.searchParams.get("phone")?.trim() ?? "";
  const outcome = url.searchParams.get("outcome")?.trim() ?? "";
  const take = Math.min(Number(url.searchParams.get("take") ?? 100), 200);

  const records = await prisma.callRecord.findMany({
    where: {
      agentId: auth.user.id,
      ...(phone ? { phoneNumber: { contains: phone } } : {}),
      ...(outcome && ALLOWED_OUTCOMES.has(outcome) ? { outcome } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: Number.isFinite(take) && take > 0 ? take : 100,
  });

  return NextResponse.json({
    records,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const phoneNo = String(body?.phoneNo ?? body?.phone ?? "").trim();
  const outcome = String(body?.outcome ?? "").trim();

  if (!phoneNo || !ALLOWED_OUTCOMES.has(outcome)) {
    return NextResponse.json({ error: "PHONE_AND_VALID_OUTCOME_REQUIRED" }, { status: 400 });
  }

  const record = await createWorkflowCallLog({
    agentId: auth.user.id,
    phoneNo,
    outcome: outcome as "CONFIRMED" | "FOLLOW_UP" | "NOT_INTERESTED",
    notes: body?.notes ? String(body.notes).trim() : null,
    landlordName: body?.landlordName ? String(body.landlordName).trim() : null,
    landlordId: body?.landlordId ?? null,
    propertyId: body?.propertyId ?? null,
    potentialLandlordId: body?.potentialLandlordId ?? null,
    scheduledFollowUpAt: body?.scheduledFollowUpAt ?? null,
  });

  return NextResponse.json({
    callRecord: record,
  });
}