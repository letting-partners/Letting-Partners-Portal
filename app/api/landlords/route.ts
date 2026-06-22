import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/requireUser";
import { normalizeNamePart, normalizePhone } from "@/server/portal/normalize";

const prisma = db as any;

function mapLandlord(landlord: any) {
  return {
    id: landlord.id,
    landlordName: landlord.landlordName,
    landlordNumber: landlord.landlordNumber,
    phoneE164: landlord.phoneE164,
    phoneLast10: landlord.phoneLast10,
    email: landlord.email,
    notes: landlord.notes,
    ownerAgentId: landlord.ownerAgentId,
    createdAt: landlord.createdAt,
    updatedAt: landlord.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const phone = url.searchParams.get("phone")?.trim() ?? "";
  const onlyMine = auth.user.role !== "ADMIN";

  const phoneDigits = phone ? phone.replace(/\D/g, "").slice(-10) : "";
  const normalizedPhone = phone ? normalizePhone(phone) : null;

  const landlords = await prisma.landlord.findMany({
    where: {
      ...(onlyMine ? { ownerAgentId: auth.user.id } : {}),
      ...(q
        ? {
            OR: [
              { landlordName: { contains: q, mode: "insensitive" as const } },
              { landlordNumber: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(normalizedPhone && normalizedPhone.ok ? { phoneLast10: normalizedPhone.phoneLast10 } : {}),
      ...(!normalizedPhone && phoneDigits ? { phoneLast10: phoneDigits } : {}),
    },
    include: {
      ownerAgent: {
        select: {
          id: true,
          agentDisplayName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return NextResponse.json({
    landlords: landlords.map((landlord: any) => ({
      ...mapLandlord(landlord),
      ownerAgent: landlord.ownerAgent,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const firstName = String(body?.firstName ?? body?.landlordFirstName ?? "").trim();
  const lastName = String(body?.lastName ?? body?.landlordLastName ?? "").trim();
  const phoneInput = String(body?.phoneNo ?? body?.phone ?? body?.landlordNumber ?? "").trim();
  const email = body?.email ? String(body.email).trim() : null;

  if (!firstName || !lastName || !phoneInput) {
    return NextResponse.json(
      { error: "FIRST_NAME_LAST_NAME_PHONE_REQUIRED" },
      { status: 400 },
    );
  }

  const normalizedPhone = normalizePhone(phoneInput);
  if (!normalizedPhone.ok) {
    return NextResponse.json({ error: normalizedPhone.message }, { status: 400 });
  }

  const landlordName = `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`.trim();
  const existing = await prisma.landlord.findUnique({
    where: {
      phoneLast10: normalizedPhone.phoneLast10,
    },
  });

  const landlord = existing
    ? await prisma.landlord.update({
        where: { id: existing.id },
        data: {
          landlordName,
          landlordNumber: phoneInput,
          phoneE164: normalizedPhone.phoneE164,
          email,
          updatedByUserId: auth.user.id,
        },
      })
    : await prisma.landlord.create({
        data: {
          landlordName,
          landlordNumber: phoneInput,
          phoneE164: normalizedPhone.phoneE164,
          phoneLast10: normalizedPhone.phoneLast10,
          email,
          createdByUserId: auth.user.id,
          updatedByUserId: auth.user.id,
          ownerAgentId: auth.user.id,
        },
      });

  return NextResponse.json({
    landlord: mapLandlord(landlord),
  });
}