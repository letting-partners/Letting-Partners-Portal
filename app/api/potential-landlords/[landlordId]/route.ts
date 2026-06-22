import { ApprovalEntityType, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { queueEditApproval } from "@/server/edit-approvals";
import { normalizeUkPhone } from "@/server/phone";

const potentialLandlordIdSchema = z.string().uuid("potential landlord id must be a valid UUID");

const patchSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: { landlordId: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const idParse = potentialLandlordIdSchema.safeParse(params.landlordId);
  if (!idParse.success) {
    return NextResponse.json(
      { error: "INVALID_POTENTIAL_LANDLORD_ID", message: idParse.error.issues[0]?.message ?? "Invalid potential landlord id." },
      { status: 400 },
    );
  }

  const landlord = await db.potentialLandlord.findUnique({
    where: { id: idParse.data },
    select: {
      id: true,
      fullName: true,
      phone: true,
      phoneLast10: true,
      createdAt: true,
      updatedAt: true,
      addedByAgentId: true,
      addedByAgent: { select: { id: true, agentDisplayName: true, email: true } },
    },
  });

  if (!landlord) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Potential landlord not found." }, { status: 404 });
  }

  if (auth.user.role !== "ADMIN" && landlord.addedByAgentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "You can only view your own potential landlords." }, { status: 403 });
  }

  return NextResponse.json({
    potentialLandlord: {
      ...landlord,
      canEdit: auth.user.role === "ADMIN" || landlord.addedByAgentId === auth.user.id,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { landlordId: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const idParse = potentialLandlordIdSchema.safeParse(params.landlordId);
  if (!idParse.success) {
    return NextResponse.json(
      { error: "INVALID_POTENTIAL_LANDLORD_ID", message: idParse.error.issues[0]?.message ?? "Invalid potential landlord id." },
      { status: 400 },
    );
  }

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid potential landlord update payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const landlord = await db.potentialLandlord.findUnique({
    where: { id: idParse.data },
    select: {
      id: true,
      fullName: true,
      phone: true,
      phoneLast10: true,
      createdAt: true,
      updatedAt: true,
      addedByAgentId: true,
      addedByAgent: { select: { id: true, agentDisplayName: true, email: true } },
    },
  });

  if (!landlord) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Potential landlord not found." }, { status: 404 });
  }

  if (auth.user.role !== "ADMIN" && landlord.addedByAgentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "You can only edit your own potential landlords." }, { status: 403 });
  }

  const updateData: Prisma.PotentialLandlordUpdateInput = {};
  const proposedChanges: Record<string, unknown> = {};
  const changedFields: string[] = [];

  if (payload.fullName !== undefined && payload.fullName !== landlord.fullName) {
    updateData.fullName = payload.fullName;
    proposedChanges.fullName = payload.fullName;
    changedFields.push("full name");
  }

  if (payload.phone !== undefined && payload.phone !== landlord.phone) {
    const normalizedPhone = normalizeUkPhone(payload.phone);
    if (!normalizedPhone.ok) {
      return NextResponse.json({ error: "INVALID_PHONE", message: normalizedPhone.message }, { status: 400 });
    }
    updateData.phone = payload.phone;
    updateData.phoneLast10 = normalizedPhone.phoneLast10;
    proposedChanges.phone = payload.phone;
    proposedChanges.phoneLast10 = normalizedPhone.phoneLast10;
    changedFields.push("phone");
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS_TO_UPDATE", message: "No fields to update." }, { status: 400 });
  }

  if (auth.user.role === "AGENT") {
    const approval = await db.$transaction(async (tx) =>
      queueEditApproval({
        tx,
        entityType: ApprovalEntityType.POTENTIAL_LANDLORD,
        entityId: landlord.id,
        requestedById: auth.user.id,
        beforeJson: landlord as unknown as Prisma.InputJsonValue,
        proposedJson: proposedChanges as Prisma.InputJsonValue,
        changedFields,
        entityLabel: landlord.fullName,
      }),
    );

    return NextResponse.json(
      {
        potentialLandlord: {
          ...landlord,
          canEdit: true,
        },
        approvalRequired: true,
        approvalRequest: approval,
        message: "Changes submitted for admin approval.",
      },
      { status: 202 },
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.potentialLandlord.update({
      where: { id: landlord.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        phone: true,
        phoneLast10: true,
        createdAt: true,
        updatedAt: true,
        addedByAgentId: true,
        addedByAgent: { select: { id: true, agentDisplayName: true, email: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "POTENTIAL_LANDLORD",
        entityId: landlord.id,
        action: "UPDATE_POTENTIAL_LANDLORD",
        metadata: { fullName: landlord.fullName },
        beforeJson: landlord as unknown as Prisma.InputJsonValue,
        afterJson: result as unknown as Prisma.InputJsonValue,
      },
    });

    return result;
  });

  return NextResponse.json({
    potentialLandlord: {
      ...updated,
      canEdit: true,
    },
  });
}
