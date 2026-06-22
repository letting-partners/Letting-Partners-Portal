import { ApprovalEntityType, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { queueEditApproval } from "@/server/edit-approvals";

// Phone is not editable after creation (used as unique identifier)
const updateTenantSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    email: z.string().trim().email().nullable().optional().or(z.literal("").transform(() => null)),
    currentAddress: z.string().trim().min(1).nullable().optional(),
    moveInDate: z.string().datetime({ offset: true }).nullable().optional().or(z.string().date().nullable().optional()),
    rentAmount: z.coerce.number().min(0).nullable().optional(),
    depositAmount: z.coerce.number().min(0).nullable().optional(),
    notes: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

type Params = { params: { tenantId: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const tenant = await db.tenant.findUnique({
    where: { id: params.tenantId },
    select: {
      id: true,
      saleId: true,
      addedByAgentId: true,
      fullName: true,
      email: true,
      phone: true,
      phoneLast10: true,
      currentAddress: true,
      moveInDate: true,
      rentAmount: true,
      depositAmount: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      addedByAgent: {
        select: { id: true, agentDisplayName: true, email: true },
      },
      sale: {
        select: {
          id: true,
          finalAmount: true,
          commissionAmount: true,
          closedAt: true,
          property: {
            select: {
              id: true,
              propertyRef: true,
              addressLine1: true,
              city: true,
              postcode: true,
              ownerAgentId: true,
              ownerAgent: { select: { id: true, agentDisplayName: true, email: true } },
              landlord: { select: { id: true, landlordName: true } },
            },
          },
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Tenant not found." }, { status: 404 });
  }

  const ownerAgentId = tenant.sale?.property.ownerAgentId ?? tenant.addedByAgentId;
  if (auth.user.role !== "ADMIN" && ownerAgentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "You can only view your own tenants." }, { status: 403 });
  }

  return NextResponse.json({
    tenant: {
      ...tenant,
      canEdit: auth.user.role === "ADMIN" || ownerAgentId === auth.user.id,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const tenant = await db.tenant.findUnique({
    where: { id: params.tenantId },
    select: {
      id: true,
      saleId: true,
      fullName: true,
      email: true,
      phone: true,
      phoneLast10: true,
      currentAddress: true,
      moveInDate: true,
      rentAmount: true,
      depositAmount: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      addedByAgentId: true,
      addedByAgent: {
        select: { id: true, agentDisplayName: true, email: true },
      },
      sale: {
        select: {
          id: true,
          finalAmount: true,
          commissionAmount: true,
          closedAt: true,
          property: {
            select: { ownerAgentId: true },
          },
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Tenant not found." }, { status: 404 });
  }

  // Determine ownership:
  // - Tenants from sales: owned by property's agent
  // - Standalone tenants: owned by addedByAgentId
  const ownerAgentId = tenant.sale?.property?.ownerAgentId ?? tenant.addedByAgentId;
  if (auth.user.role !== "ADMIN" && ownerAgentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "You can only edit your own tenants." }, { status: 403 });
  }

  let payload: z.infer<typeof updateTenantSchema>;
  try {
    payload = updateTenantSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Invalid tenant update payload.", details: error instanceof z.ZodError ? error.flatten() : undefined },
      { status: 400 },
    );
  }

  const updateData: Prisma.TenantUpdateInput = {};
  const proposedChanges: Record<string, unknown> = {};
  const changedFields: string[] = [];
  if (payload.fullName !== undefined && payload.fullName !== tenant.fullName) {
    updateData.fullName = payload.fullName;
    proposedChanges.fullName = payload.fullName;
    changedFields.push("full name");
  }
  if (payload.email !== undefined && payload.email !== tenant.email) {
    updateData.email = payload.email;
    proposedChanges.email = payload.email;
    changedFields.push("email");
  }
  if (payload.currentAddress !== undefined && payload.currentAddress !== tenant.currentAddress) {
    updateData.currentAddress = payload.currentAddress;
    proposedChanges.currentAddress = payload.currentAddress;
    changedFields.push("current address");
  }
  if (payload.moveInDate !== undefined) {
    const nextMoveInDate = payload.moveInDate ? new Date(payload.moveInDate) : null;
    if (String(nextMoveInDate) !== String(tenant.moveInDate)) {
      updateData.moveInDate = nextMoveInDate;
      proposedChanges.moveInDate = nextMoveInDate ? nextMoveInDate.toISOString() : null;
      changedFields.push("move-in date");
    }
  }
  if (payload.rentAmount !== undefined && String(payload.rentAmount) !== String(tenant.rentAmount)) {
    updateData.rentAmount = payload.rentAmount;
    proposedChanges.rentAmount = payload.rentAmount;
    changedFields.push("rent amount");
  }
  if (payload.depositAmount !== undefined && String(payload.depositAmount) !== String(tenant.depositAmount)) {
    updateData.depositAmount = payload.depositAmount;
    proposedChanges.depositAmount = payload.depositAmount;
    changedFields.push("deposit amount");
  }
  if (payload.notes !== undefined && payload.notes !== tenant.notes) {
    updateData.notes = payload.notes;
    proposedChanges.notes = payload.notes;
    changedFields.push("notes");
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS_TO_UPDATE", message: "No fields to update." }, { status: 400 });
  }

  if (auth.user.role === "AGENT") {
    const approval = await db.$transaction(async (tx) =>
      queueEditApproval({
        tx,
        entityType: ApprovalEntityType.TENANT,
        entityId: tenant.id,
        requestedById: auth.user.id,
        beforeJson: tenant as unknown as Prisma.InputJsonValue,
        proposedJson: proposedChanges as Prisma.InputJsonValue,
        changedFields,
        entityLabel: tenant.fullName,
      }),
    );

    return NextResponse.json(
      {
        tenant: {
          ...tenant,
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
    const result = await tx.tenant.update({
      where: { id: tenant.id },
      data: updateData,
      select: {
        id: true, fullName: true, email: true, phone: true, phoneLast10: true,
        currentAddress: true, moveInDate: true, rentAmount: true,
        depositAmount: true, notes: true, createdAt: true, updatedAt: true,
        saleId: true, addedByAgentId: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "TENANT",
        entityId: tenant.id,
        action: "UPDATE_TENANT",
        metadata: { fullName: tenant.fullName },
        beforeJson: tenant as unknown as Prisma.InputJsonValue,
        afterJson: result as unknown as Prisma.InputJsonValue,
      },
    });

    return result;
  });

  return NextResponse.json({ tenant: updated });
}
