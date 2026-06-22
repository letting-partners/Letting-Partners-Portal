import { ApprovalEntityType, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { queueEditApproval } from "@/server/edit-approvals";
import { canEditProperty } from "@/server/policies";
import { syncPropertyRoomCounts } from "@/server/property-rooms";

type Params = { params: { propertyId: string; roomId: string } };

const roomUpdateSchema = z
  .object({
    roomName: z.string().trim().min(1).max(120).optional(),
    landlordDemand: z.coerce.number().positive().nullable().optional(),
    expectedCommissionPct: z.coerce.number().min(0).max(9999).nullable().optional(),
  })
  .strict();

const propertyForRoomApprovalSelect = Prisma.validator<Prisma.PropertySelect>()({
  id: true,
  propertyRef: true,
  addressLine1: true,
  ownerAgentId: true,
  landlord: {
    select: {
      ownerAgentId: true,
    },
  },
  rooms: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      propertyId: true,
      roomName: true,
      landlordDemand: true,
      expectedCommissionPct: true,
      status: true,
      createdAt: true,
      sale: {
        select: {
          id: true,
        },
      },
    },
  },
});

async function getPropertyAndRoom(propertyId: string, roomId: string) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: propertyForRoomApprovalSelect,
  });

  if (!property) {
    return { property: null, room: null };
  }

  const room = property.rooms.find((item) => item.id === roomId) ?? null;
  return { property, room };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  let payload: z.infer<typeof roomUpdateSchema>;
  try {
    payload = roomUpdateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid room update payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const { property, room } = await getPropertyAndRoom(params.propertyId, params.roomId);

  if (!property || !room) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Room not found." }, { status: 404 });
  }

  if (
    !canEditProperty(auth.user, {
      ownerAgentId: property.ownerAgentId,
      landlordOwnerAgentId: property.landlord.ownerAgentId,
    })
  ) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Access denied." }, { status: 403 });
  }

  const roomUpdateData: Prisma.PropertyRoomUncheckedUpdateInput = {};
  const proposedChanges: Record<string, unknown> = {};
  const changedFields: string[] = [];

  if (payload.roomName !== undefined && payload.roomName !== room.roomName) {
    roomUpdateData.roomName = payload.roomName;
    proposedChanges.roomName = payload.roomName;
    changedFields.push("room name");
  }

  if (
    payload.landlordDemand !== undefined &&
    String(payload.landlordDemand) !== String(room.landlordDemand)
  ) {
    roomUpdateData.landlordDemand = payload.landlordDemand;
    proposedChanges.landlordDemand = payload.landlordDemand;
    changedFields.push("room demand");
  }

  if (
    payload.expectedCommissionPct !== undefined &&
    String(payload.expectedCommissionPct) !== String(room.expectedCommissionPct)
  ) {
    roomUpdateData.expectedCommissionPct = payload.expectedCommissionPct;
    proposedChanges.expectedCommissionPct = payload.expectedCommissionPct;
    changedFields.push("room commission");
  }

  if (changedFields.length === 0) {
    return NextResponse.json(
      {
        error: "NO_FIELDS_TO_UPDATE",
        message: "No effective room changes were provided.",
      },
      { status: 400 },
    );
  }

  if (auth.user.role === "AGENT") {
    const approval = await db.$transaction(async (tx) =>
      queueEditApproval({
        tx,
        entityType: ApprovalEntityType.PROPERTY,
        entityId: property.id,
        requestedById: auth.user.id,
        beforeJson: property as unknown as Prisma.InputJsonValue,
        proposedJson: {
          roomActions: [
            {
              type: "UPDATE",
              roomId: room.id,
              updates: proposedChanges,
            },
          ],
        } as Prisma.InputJsonValue,
        changedFields: changedFields.map((field) => `${room.roomName} ${field}`),
        entityLabel: property.addressLine1 ?? property.propertyRef,
      }),
    );

    return NextResponse.json(
      {
        approvalRequired: true,
        approvalRequest: approval,
        message: "Room changes submitted for admin approval.",
      },
      { status: 202 },
    );
  }

  const updatedRoom = await db.$transaction(async (tx) => {
    const updated = await tx.propertyRoom.update({
      where: { id: room.id },
      data: roomUpdateData,
      select: {
        id: true,
        propertyId: true,
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
            tenant: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "PROPERTY",
        entityId: property.id,
        action: "UPDATE_PROPERTY_ROOM",
        metadata: {
          roomId: room.id,
          propertyId: property.id,
        },
        beforeJson: room as unknown as Prisma.InputJsonValue,
        afterJson: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  });

  return NextResponse.json({
    room: updatedRoom,
    message: "Room updated.",
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const { property, room } = await getPropertyAndRoom(params.propertyId, params.roomId);

  if (!property || !room) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Room not found." }, { status: 404 });
  }

  if (
    !canEditProperty(auth.user, {
      ownerAgentId: property.ownerAgentId,
      landlordOwnerAgentId: property.landlord.ownerAgentId,
    })
  ) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Access denied." }, { status: 403 });
  }

  if (room.sale) {
    return NextResponse.json(
      {
        error: "ROOM_HAS_SALE",
        message: "Rooms with an existing sale record cannot be deleted.",
      },
      { status: 409 },
    );
  }

  if (auth.user.role === "AGENT") {
    const approval = await db.$transaction(async (tx) =>
      queueEditApproval({
        tx,
        entityType: ApprovalEntityType.PROPERTY,
        entityId: property.id,
        requestedById: auth.user.id,
        beforeJson: property as unknown as Prisma.InputJsonValue,
        proposedJson: {
          roomActions: [
            {
              type: "DELETE",
              roomId: room.id,
            },
          ],
        } as Prisma.InputJsonValue,
        changedFields: [`delete room ${room.roomName}`],
        entityLabel: property.addressLine1 ?? property.propertyRef,
      }),
    );

    return NextResponse.json(
      {
        approvalRequired: true,
        approvalRequest: approval,
        message: "Room deletion submitted for admin approval.",
      },
      { status: 202 },
    );
  }

  await db.$transaction(async (tx) => {
    await tx.propertyRoom.delete({
      where: { id: room.id },
    });

    await syncPropertyRoomCounts(tx, property.id);

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "PROPERTY",
        entityId: property.id,
        action: "DELETE_PROPERTY_ROOM",
        metadata: {
          roomId: room.id,
          propertyId: property.id,
          roomName: room.roomName,
        },
        beforeJson: room as unknown as Prisma.InputJsonValue,
        afterJson: Prisma.JsonNull,
      },
    });
  });

  return NextResponse.json({
    deletedRoomId: room.id,
    message: "Room deleted.",
  });
}
