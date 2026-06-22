import { ApprovalEntityType, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import {
  canChangeLandlordOwnership,
  canEditLandlord,
  canViewLandlordRegistry,
} from "@/server/policies";
import { queueEditApproval } from "@/server/edit-approvals";

const landlordIdSchema = z.string().uuid("landlord id must be a valid UUID");

const optionalEmailSchema = z.union([z.string().trim().email(), z.literal(""), z.null()]).optional();
const optionalNotesSchema = z.union([z.string().trim().max(5000), z.literal(""), z.null()]).optional();

// Agents: can edit name, email, notes + manually mark their own landlord passive (only to true)
const agentPatchSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    email: optionalEmailSchema,
    notes: optionalNotesSchema,
    isPassive: z.literal(true).optional(), // agents can only set passive, not reactivate
  })
  .strict();

// Admins: can also change owner and set isPassive either way
const adminPatchSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    email: optionalEmailSchema,
    notes: optionalNotesSchema,
    isPassive: z.boolean().optional(),
    ownerAgentId: z.string().uuid().optional(),
    reassignmentReason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

type Params = {
  params: {
    landlordId: string;
  };
};

async function ensureOwnerAgent(ownerAgentId: string) {
  const user = await db.user.findUnique({
    where: { id: ownerAgentId },
    select: { id: true, role: true, isActive: true },
  });

  if (!user || user.role !== "AGENT" || !user.isActive) {
    return null;
  }

  return user;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  if (!canViewLandlordRegistry(auth.user)) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Access denied." }, { status: 403 });
  }

  const idParse = landlordIdSchema.safeParse(params.landlordId);
  if (!idParse.success) {
    return NextResponse.json(
      {
        error: "INVALID_LANDLORD_ID",
        message: idParse.error.issues[0]?.message ?? "Invalid landlord id.",
      },
      { status: 400 },
    );
  }

  const landlord = await db.landlord.findUnique({
    where: { id: idParse.data },
    select: {
      id: true,
      landlordName: true,
      landlordNumber: true,
      phoneE164: true,
      phoneLast10: true,
      email: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      createdByUserId: true,
      updatedByUserId: true,
      ownerAgentId: true,
      ownerAgent: {
        select: {
          id: true,
          agentDisplayName: true,
        },
      },
      _count: {
        select: {
          properties: true,
        },
      },
    },
  });

  if (!landlord) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Landlord not found." }, { status: 404 });
  }

  if (auth.user.role === "AGENT" && landlord.ownerAgentId !== auth.user.id) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Agents can only access their own landlords.",
      },
      { status: 403 },
    );
  }

  const canEdit = canEditLandlord(auth.user, landlord);

  return NextResponse.json({
    landlord: {
      ...landlord,
      canEdit,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const idParse = landlordIdSchema.safeParse(params.landlordId);
  if (!idParse.success) {
    return NextResponse.json(
      {
        error: "INVALID_LANDLORD_ID",
        message: idParse.error.issues[0]?.message ?? "Invalid landlord id.",
      },
      { status: 400 },
    );
  }

  let payload: z.infer<typeof adminPatchSchema>;
  try {
    payload =
      auth.user.role === "ADMIN"
        ? adminPatchSchema.parse(await request.json())
        : agentPatchSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid update payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      {
        error: "NO_FIELDS_TO_UPDATE",
        message: "At least one updatable field must be provided.",
      },
      { status: 400 },
    );
  }

  const currentLandlord = await db.landlord.findUnique({
    where: { id: idParse.data },
    select: {
      id: true,
      landlordName: true,
      landlordNumber: true,
      phoneE164: true,
      phoneLast10: true,
      email: true,
      notes: true,
      isPassive: true,
      passiveMarkedAt: true,
      createdAt: true,
      updatedAt: true,
      createdByUserId: true,
      updatedByUserId: true,
      ownerAgentId: true,
      ownerAgent: {
        select: { id: true, agentDisplayName: true },
      },
      _count: {
        select: { properties: true },
      },
    },
  });

  if (!currentLandlord) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Landlord not found." }, { status: 404 });
  }

  if (!canEditLandlord(auth.user, currentLandlord)) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "You cannot edit this landlord.",
      },
      { status: 403 },
    );
  }

  const updateData: Prisma.LandlordUncheckedUpdateInput = {
    updatedByUserId: auth.user.id,
  };
  const proposedChanges: Record<string, unknown> = {};
  const changedFields: string[] = [];
  let hasChanges = false;
  const nextPhoneLast10 = currentLandlord.phoneLast10;
  const nextPhoneE164 = currentLandlord.phoneE164;

  if (payload.fullName !== undefined && payload.fullName !== currentLandlord.landlordName) {
    updateData.landlordName = payload.fullName;
    proposedChanges.fullName = payload.fullName;
    changedFields.push("full name");
    hasChanges = true;
  }

  if (payload.email !== undefined) {
    const nextEmail = payload.email?.trim() || null;
    if (nextEmail !== currentLandlord.email) {
      updateData.email = nextEmail;
      proposedChanges.email = nextEmail;
      changedFields.push("email");
      hasChanges = true;
    }
  }

  if (payload.notes !== undefined) {
    const nextNotes = payload.notes?.trim() || null;
    if (nextNotes !== currentLandlord.notes) {
      updateData.notes = nextNotes;
      proposedChanges.notes = nextNotes;
      changedFields.push("notes");
      hasChanges = true;
    }
  }

  if ("isPassive" in payload && payload.isPassive !== undefined) {
    // Agents can only set passive=true; admins can set either way
    if (auth.user.role === "AGENT" && payload.isPassive !== true) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Agents can only mark a landlord as passive, not reactivate." },
        { status: 403 },
      );
    }
    const currentIsPassive = (currentLandlord as unknown as { isPassive: boolean }).isPassive ?? false;
    if (payload.isPassive !== currentIsPassive) {
      updateData.isPassive = payload.isPassive;
      updateData.passiveMarkedAt = payload.isPassive ? new Date() : null;
      proposedChanges.isPassive = payload.isPassive;
      changedFields.push("status");
      hasChanges = true;
    }
  }

  if ("ownerAgentId" in payload && payload.ownerAgentId !== undefined) {
    if (!canChangeLandlordOwnership(auth.user)) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "Only ADMIN can change landlord ownership.",
        },
        { status: 403 },
      );
    }

    const ownerAgent = await ensureOwnerAgent(payload.ownerAgentId);
    if (!ownerAgent) {
      return NextResponse.json(
        {
          error: "INVALID_OWNER_AGENT",
          message: "ownerAgentId must reference an active AGENT user.",
        },
        { status: 400 },
      );
    }

    if (payload.ownerAgentId !== currentLandlord.ownerAgentId) {
      if (!payload.reassignmentReason) {
        return NextResponse.json(
          {
            error: "REASSIGNMENT_REASON_REQUIRED",
            message: "reassignmentReason is required when changing ownerAgentId.",
          },
          { status: 400 },
        );
      }

      updateData.ownerAgentId = payload.ownerAgentId;
      proposedChanges.ownerAgentId = payload.ownerAgentId;
      proposedChanges.reassignmentReason = payload.reassignmentReason;
      changedFields.push("owner agent");
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return NextResponse.json(
      {
        error: "NO_FIELDS_TO_UPDATE",
        message: "No effective changes were provided.",
      },
      { status: 400 },
    );
  }

  if (auth.user.role === "AGENT") {
    const approval = await db.$transaction(async (tx) =>
      queueEditApproval({
        tx,
        entityType: ApprovalEntityType.LANDLORD,
        entityId: currentLandlord.id,
        requestedById: auth.user.id,
        beforeJson: currentLandlord as unknown as Prisma.InputJsonValue,
        proposedJson: proposedChanges as Prisma.InputJsonValue,
        changedFields,
        entityLabel: currentLandlord.landlordName,
      }),
    );

    return NextResponse.json(
      {
        landlord: {
          ...currentLandlord,
          canEdit: canEditLandlord(auth.user, currentLandlord),
        },
        approvalRequired: true,
        approvalRequest: approval,
        message: "Changes submitted for admin approval.",
      },
      { status: 202 },
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const landlord = await tx.landlord.update({
      where: { id: currentLandlord.id },
      data: updateData,
      select: {
        id: true,
        landlordName: true,
        landlordNumber: true,
        phoneE164: true,
        phoneLast10: true,
        email: true,
        notes: true,
        isPassive: true,
        passiveMarkedAt: true,
        createdAt: true,
        updatedAt: true,
        createdByUserId: true,
        updatedByUserId: true,
        ownerAgentId: true,
        ownerAgent: {
          select: { id: true, agentDisplayName: true },
        },
        _count: {
          select: { properties: true },
        },
      },
    });

    const ownerChanged = landlord.ownerAgentId !== currentLandlord.ownerAgentId;
    const action = ownerChanged ? "REASSIGN_LANDLORD_OWNER" : "UPDATE_LANDLORD";
    const metadata = ownerChanged
      ? {
          fromOwnerAgentId: currentLandlord.ownerAgentId,
          toOwnerAgentId: landlord.ownerAgentId,
          reason: ("reassignmentReason" in payload ? payload.reassignmentReason : null) ?? null,
        }
      : { phoneLast10: nextPhoneLast10, phoneE164: nextPhoneE164 };

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "LANDLORD",
        entityId: landlord.id,
        action,
        metadata,
        beforeJson: currentLandlord,
        afterJson: landlord,
      },
    });

    return landlord;
  });

  return NextResponse.json({
    landlord: {
      ...updated,
      canEdit: canEditLandlord(auth.user, updated),
    },
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const idParse = landlordIdSchema.safeParse(params.landlordId);
  if (!idParse.success) {
    return NextResponse.json(
      { error: "INVALID_LANDLORD_ID", message: "Invalid landlord id." },
      { status: 400 },
    );
  }

  const landlord = await db.landlord.findUnique({
    where: { id: idParse.data },
    select: { id: true, landlordName: true, phoneLast10: true, ownerAgentId: true },
  });

  if (!landlord) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Landlord not found." }, { status: 404 });
  }

  await db.$transaction([
    db.landlord.delete({ where: { id: landlord.id } }),
    db.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "LANDLORD",
        entityId: landlord.id,
        action: "DELETE_LANDLORD",
        metadata: { landlordName: landlord.landlordName, phoneLast10: landlord.phoneLast10 },
        beforeJson: landlord,
        afterJson: Prisma.JsonNull,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
