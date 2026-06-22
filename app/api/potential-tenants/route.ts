import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/requireUser";
import { normalizeNamePart, normalizePhone, normalizePostcode } from "@/server/portal/normalize";

const prisma = db as any;

function mapPotentialTenant(row: any) {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    phoneLast10: row.phoneLast10,
    phoneE164: row.phoneE164,
    postcode: row.postcode,
    postcodeCanonical: row.postcodeCanonical,
    preferredArea: row.preferredArea,
    interestedIn: row.interestedIn,
    budget: row.budget,
    budgetMin: row.budgetMin,
    budgetMax: row.budgetMax,
    moveInDate: row.moveInDate,
    moveInFlexible: row.moveInFlexible,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const onlyMine = auth.user.role !== "ADMIN";

  const rows = await prisma.potentialTenant.findMany({
    where: {
      ...(onlyMine ? { addedByAgentId: auth.user.id } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    potentialTenants: rows.map(mapPotentialTenant),
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

  const fullName = String(body.fullName ?? body.name ?? "").trim();
  if (!fullName) {
    return NextResponse.json({ error: "FULL_NAME_REQUIRED" }, { status: 400 });
  }

  const phoneInput = String(body.phoneNo ?? body.phone ?? "").trim();
  const normalizedPhone = phoneInput ? normalizePhone(phoneInput) : null;
  if (phoneInput && normalizedPhone && !normalizedPhone.ok) {
    return NextResponse.json({ error: normalizedPhone.message }, { status: 400 });
  }

  const postcodeInput = body.postcode ? String(body.postcode).trim() : "";
  const currentLivingPostcode = body.currentLivingPostcode ? normalizePostcode(String(body.currentLivingPostcode).trim()) : null;
  const workplacePostcode = body.workplacePostcode ? normalizePostcode(String(body.workplacePostcode).trim()) : null;

  const potentialTenant = await prisma.potentialTenant.create({
    data: {
      addedByAgentId: auth.user.id,
      fullName: normalizeNamePart(fullName),
      email: body.email ? String(body.email).trim() : null,
      phone: phoneInput || null,
      phoneLast10: normalizedPhone && normalizedPhone.ok ? normalizedPhone.phoneLast10 : null,
      phoneE164: normalizedPhone && normalizedPhone.ok ? normalizedPhone.phoneE164 : null,
      postcode: postcodeInput || null,
      postcodeCanonical: postcodeInput ? normalizePostcode(postcodeInput) : null,
      preferredArea: body.preferredArea ? String(body.preferredArea).trim() : null,
      interestedIn: body.interestedIn ? String(body.interestedIn).trim() : null,
      budget: body.budget ? String(body.budget).trim() : null,
      budgetMin: body.budgetMin ? String(body.budgetMin).trim() : null,
      budgetMax: body.budgetMax ? String(body.budgetMax).trim() : null,
      moveInDate: body.moveInDate ? new Date(body.moveInDate) : null,
      moveInFlexible: body.moveInFlexible == null ? null : Boolean(body.moveInFlexible),
      notes: body.notes ? String(body.notes).trim() : null,
      // V2 fields
      firstName: body.firstName ? normalizeNamePart(String(body.firstName).trim()) : null,
      lastName: body.lastName ? normalizeNamePart(String(body.lastName).trim()) : null,
      accommodationType: body.accommodationType ?? null,
      countryOriginal: body.countryOriginal ? String(body.countryOriginal).trim() : null,
      nationality: body.nationality ? String(body.nationality).trim() : null,
      tenantRoomType: body.tenantRoomType ?? null,
      numberOfOccupants: body.numberOfOccupants ? Number(body.numberOfOccupants) : null,
      numberOfChildren: body.numberOfChildren ? Number(body.numberOfChildren) : null,
      onDSS: body.onDSS == null ? null : Boolean(body.onDSS),
      currentlyEmployed: body.currentlyEmployed == null ? null : Boolean(body.currentlyEmployed),
      annualIncome: body.annualIncome ? Number(body.annualIncome) : null,
      currentLivingPostcode,
      workplacePostcode,
      maximumBudget: body.maximumBudget ? Number(body.maximumBudget) : null,
      workingProfession: body.workingProfession ? String(body.workingProfession).trim() : null,
      immigrationStatus: body.immigrationStatus ? String(body.immigrationStatus).trim() : null,
    },
  });

  return NextResponse.json({
    potentialTenant: mapPotentialTenant(potentialTenant),
  });
}