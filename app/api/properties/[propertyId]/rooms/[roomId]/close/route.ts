import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { canEditProperty } from "@/server/policies";
import { syncPropertyRoomCounts } from "@/server/property-rooms";

type Params = { params: { propertyId: string; roomId: string } };

const closeRoomSchema = z.object({
  finalAmount: z.coerce.number().positive("finalAmount must be > 0"),
  commissionPct: z.coerce.number().min(0).max(9999),
  otherCosts: z.coerce.number().min(0).optional(),
  tenant: z.object({
    fullName: z.string().trim().min(1, "Tenant full name is required"),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().optional(),
    currentAddress: z.string().trim().optional(),
    moveInDate: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
    rentAmount: z.coerce.number().min(0).optional(),
    depositAmount: z.coerce.number().min(0).optional(),
    notes: z.string().trim().optional(),
    accommodationType: z.enum(["PRIVATE", "SHARED"]).optional(),
    tenantRoomType: z.enum(["STUDIO_ROOM", "SINGLE_ROOM", "DOUBLE_ROOM", "ENSUITE_ROOM", "LOFT"]).optional(),
    countryOriginal: z.string().trim().optional(),
    nationality: z.string().trim().optional(),
    numberOfOccupants: z.coerce.number().int().min(0).optional(),
    numberOfChildren: z.coerce.number().int().min(0).optional(),
    onDSS: z.boolean().optional(),
    currentlyEmployed: z.boolean().optional(),
    annualIncome: z.coerce.number().min(0).optional(),
    currentLivingPostcode: z.string().trim().optional(),
    workplacePostcode: z.string().trim().optional(),
    maximumBudget: z.coerce.number().min(0).optional(),
    workingProfession: z.string().trim().optional(),
    immigrationStatus: z.string().trim().optional(),
  }),
});

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  let payload: z.infer<typeof closeRoomSchema>;
  try {
    payload = closeRoomSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Invalid close-room payload.", details: error instanceof z.ZodError ? error.flatten() : undefined },
      { status: 400 },
    );
  }

  // Fetch the room with property info
  const room = await db.propertyRoom.findUnique({
    where: { id: params.roomId },
    select: {
      id: true,
      roomName: true,
      status: true,
      propertyId: true,
      sale: { select: { id: true } },
      property: {
        select: {
          id: true,
          ownerAgentId: true,
          landlordId: true,
          status: true,
          vacancyType: true,
          landlord: { select: { id: true, ownerAgentId: true, phoneLast10: true } },
        },
      },
    },
  });

  if (!room || room.propertyId !== params.propertyId) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Room not found." }, { status: 404 });
  }

  if (!canEditProperty(auth.user, { ownerAgentId: room.property.ownerAgentId, landlordOwnerAgentId: room.property.landlord.ownerAgentId })) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Only the owner agent or admin can close this sale." }, { status: 403 });
  }

  if (room.property.vacancyType !== "MULTIPLE") {
    return NextResponse.json(
      { error: "INVALID_VACANCY_TYPE", message: "Room sale close is only valid for MULTIPLE vacancy properties." },
      { status: 400 },
    );
  }

  if (room.sale) {
    return NextResponse.json({ error: "SALE_ALREADY_EXISTS", message: "This room already has a sale record." }, { status: 409 });
  }

  if (room.status === "CLOSED") {
    return NextResponse.json({ error: "ROOM_ALREADY_CLOSED", message: "This room is already closed." }, { status: 409 });
  }

  const closablePropertyStatuses = ["AVAILABLE", "DRAFT"];
  if (!closablePropertyStatuses.includes(room.property.status)) {
    return NextResponse.json(
      { error: "INVALID_PROPERTY_STATUS", message: "Property must be AVAILABLE or DRAFT to close a room sale." },
      { status: 400 },
    );
  }

  const finalAmount    = round2(payload.finalAmount);
  const commissionPct  = round2(payload.commissionPct);
  const otherCosts     = round2(payload.otherCosts ?? 0);
  const commissionAmt  = round2(finalAmount * (commissionPct / 100));
  const profit         = round2(commissionAmt - otherCosts);

  const result = await db.$transaction(async (tx) => {
    // Create sale linked to both property and room
    const sale = await tx.sale.create({
      data: {
        propertyId: room.propertyId,
        roomId: room.id,
        closedByUserId: auth.user.id,
        finalAmount,
        commissionPct,
        commissionAmount: commissionAmt,
        otherCosts,
        profit,
      },
      select: {
        id: true,
        propertyId: true,
        roomId: true,
        finalAmount: true,
        commissionPct: true,
        commissionAmount: true,
        otherCosts: true,
        profit: true,
        closedAt: true,
      },
    });

    const tenant = await (tx as any).tenant.create({
      data: {
        saleId: sale.id,
        addedByAgentId: auth.user.id,
        fullName: payload.tenant.fullName,
        firstName: payload.tenant.firstName?.trim() || null,
        lastName: payload.tenant.lastName?.trim() || null,
        email: payload.tenant.email?.trim() || null,
        phone: payload.tenant.phone?.trim() || null,
        currentAddress: payload.tenant.currentAddress?.trim() || null,
        moveInDate: payload.tenant.moveInDate ? new Date(payload.tenant.moveInDate) : null,
        rentAmount: payload.tenant.rentAmount ?? null,
        depositAmount: payload.tenant.depositAmount ?? null,
        notes: payload.tenant.notes?.trim() || null,
        accommodationType: payload.tenant.accommodationType ?? null,
        tenantRoomType: payload.tenant.tenantRoomType ?? null,
        countryOriginal: payload.tenant.countryOriginal?.trim() || null,
        nationality: payload.tenant.nationality?.trim() || null,
        numberOfOccupants: payload.tenant.numberOfOccupants ?? null,
        numberOfChildren: payload.tenant.numberOfChildren ?? null,
        onDSS: payload.tenant.onDSS ?? null,
        currentlyEmployed: payload.tenant.currentlyEmployed ?? null,
        annualIncome: payload.tenant.annualIncome ?? null,
        currentLivingPostcode: payload.tenant.currentLivingPostcode?.toUpperCase() || null,
        workplacePostcode: payload.tenant.workplacePostcode?.toUpperCase() || null,
        maximumBudget: payload.tenant.maximumBudget ?? null,
        workingProfession: payload.tenant.workingProfession?.trim() || null,
        immigrationStatus: payload.tenant.immigrationStatus?.trim() || null,
      },
      select: { id: true, fullName: true },
    });

    // Mark this room as CLOSED
    await tx.propertyRoom.update({
      where: { id: room.id },
      data: { status: "CLOSED" },
    });

    await syncPropertyRoomCounts(tx, room.propertyId);

    // Check if ALL rooms of this property are now CLOSED
    const openRoomsCount = await tx.propertyRoom.count({
      where: { propertyId: room.propertyId, status: { not: "CLOSED" } },
    });

    if (openRoomsCount === 0) {
      // All rooms closed — mark property as SOLD
      await tx.property.update({
        where: { id: room.propertyId },
        data: { status: "CLOSED" },
      });
    }

    // Reactivate landlord if passive
    await tx.landlord.updateMany({
      where: {
        id: room.property.landlord.id,
        isPassive: true,
      },
      data: { isPassive: false, passiveMarkedAt: null },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "PROPERTY",
        entityId: room.propertyId,
        action: "CLOSE_ROOM_SALE",
        metadata: {
          roomId: room.id,
          roomName: room.roomName,
          landlordId: room.property.landlordId,
          phoneLast10: room.property.landlord.phoneLast10,
          finalAmount,
          commissionPct,
          commissionAmount: commissionAmt,
          otherCosts,
          profit,
          tenantId: tenant.id,
          tenantFullName: tenant.fullName,
          allRoomsClosed: openRoomsCount === 0,
        },
        beforeJson: { roomStatus: room.status },
        afterJson: { roomStatus: "CLOSED", sale, allRoomsClosed: openRoomsCount === 0 },
      },
    });

    // Increment salesClosed in daily report
    const now2 = new Date();
    const reportDate = new Date(Date.UTC(now2.getUTCFullYear(), now2.getUTCMonth(), now2.getUTCDate()));
    await (tx as any).dailyReport.upsert({
      where: { agentId_reportDate: { agentId: auth.user.id, reportDate } },
      create: { agentId: auth.user.id, reportDate, callsMade: 0, salesClosed: 1 },
      update: { salesClosed: { increment: 1 } },
    });

    return { sale, tenant, allRoomsClosed: openRoomsCount === 0 };
  });

  return NextResponse.json({ sale: result.sale, tenant: result.tenant, allRoomsClosed: result.allRoomsClosed }, { status: 201 });
}
