import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { canEditProperty } from "@/server/policies";
import { syncPropertyRoomCounts } from "@/server/property-rooms";

type Params = { params: { propertyId: string } };

const addRoomSchema = z.object({
  roomName: z.string().trim().min(1, "Room name is required"),
  landlordDemand: z.coerce.number().positive().nullable().optional(),
  expectedCommissionPct: z.coerce.number().min(0).max(9999).nullable().optional(),
});

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const property = await db.property.findUnique({
    where: { id: params.propertyId },
    select: {
      ownerAgentId: true,
      vacancyType: true,
      landlord: { select: { ownerAgentId: true } },
      rooms: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          roomName: true,
          landlordDemand: true,
          expectedCommissionPct: true,
          status: true,
          createdAt: true,
          sale: {
            select: {
              id: true,
              finalAmount: true,
              commissionAmount: true,
              profit: true,
              closedAt: true,
              tenant: { select: { id: true, fullName: true } },
            },
          },
        },
      },
    },
  });

  if (!property) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Property not found." }, { status: 404 });
  }

  if (!canEditProperty(auth.user, { ownerAgentId: property.ownerAgentId, landlordOwnerAgentId: property.landlord.ownerAgentId })) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Access denied." }, { status: 403 });
  }

  return NextResponse.json({ rooms: property.rooms, vacancyType: property.vacancyType });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  let payload: z.infer<typeof addRoomSchema>;
  try {
    payload = addRoomSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Invalid room payload.", details: error instanceof z.ZodError ? error.flatten() : undefined },
      { status: 400 },
    );
  }

  const property = await db.property.findUnique({
    where: { id: params.propertyId },
    select: {
      ownerAgentId: true,
      vacancyType: true,
      landlord: { select: { ownerAgentId: true } },
    },
  });

  if (!property) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Property not found." }, { status: 404 });
  }

  if (!canEditProperty(auth.user, { ownerAgentId: property.ownerAgentId, landlordOwnerAgentId: property.landlord.ownerAgentId })) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Access denied." }, { status: 403 });
  }

  if (property.vacancyType !== "MULTIPLE") {
    return NextResponse.json(
      { error: "INVALID_VACANCY_TYPE", message: "Rooms can only be added to MULTIPLE vacancy properties." },
      { status: 400 },
    );
  }

  const room = await db.$transaction(async (tx) => {
    const createdRoom = await tx.propertyRoom.create({
      data: {
        propertyId: params.propertyId,
        roomName: payload.roomName,
        landlordDemand: payload.landlordDemand ?? null,
        expectedCommissionPct: payload.expectedCommissionPct ?? null,
      },
      select: {
        id: true,
        roomName: true,
        landlordDemand: true,
        expectedCommissionPct: true,
        status: true,
        createdAt: true,
      },
    });

    await syncPropertyRoomCounts(tx, params.propertyId);
    return createdRoom;
  });

  return NextResponse.json({ room }, { status: 201 });
}
