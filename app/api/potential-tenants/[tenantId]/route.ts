import { ApprovalEntityType, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { queueEditApproval } from "@/server/edit-approvals";

const potentialTenantIdSchema = z.string().uuid("potential tenant id must be a valid UUID");

const patchSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    email: z.string().trim().email().nullable().optional().or(z.literal("").transform(() => null)),
    phone: z.string().trim().nullable().optional().or(z.literal("").transform(() => null)),
    interestedIn: z.string().trim().nullable().optional().or(z.literal("").transform(() => null)),
    budget: z.string().trim().nullable().optional().or(z.literal("").transform(() => null)),
    notes: z.string().trim().max(5000).nullable().optional().or(z.literal("").transform(() => null)),
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const idParse = potentialTenantIdSchema.safeParse(params.tenantId);
  if (!idParse.success) {
    return NextResponse.json(
      { error: "INVALID_POTENTIAL_TENANT_ID", message: idParse.error.issues[0]?.message ?? "Invalid potential tenant id." },
      { status: 400 },
    );
  }

  const tenant = await db.potentialTenant.findUnique({
    where: { id: idParse.data },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      interestedIn: true,
      budget: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      addedByAgentId: true,
      addedByAgent: { select: { id: true, agentDisplayName: true, email: true } },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Potential tenant not found." }, { status: 404 });
  }

  if (auth.user.role !== "ADMIN" && tenant.addedByAgentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "You can only view your own potential tenants." }, { status: 403 });
  }

  return NextResponse.json({
    potentialTenant: {
      ...tenant,
      canEdit: auth.user.role === "ADMIN" || tenant.addedByAgentId === auth.user.id,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const idParse = potentialTenantIdSchema.safeParse(params.tenantId);
  if (!idParse.success) {
    return NextResponse.json(
      { error: "INVALID_POTENTIAL_TENANT_ID", message: idParse.error.issues[0]?.message ?? "Invalid potential tenant id." },
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
        message: "Invalid potential tenant update payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const tenant = await db.potentialTenant.findUnique({
    where: { id: idParse.data },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      interestedIn: true,
      budget: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      addedByAgentId: true,
      addedByAgent: { select: { id: true, agentDisplayName: true, email: true } },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Potential tenant not found." }, { status: 404 });
  }

  if (auth.user.role !== "ADMIN" && tenant.addedByAgentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "You can only edit your own potential tenants." }, { status: 403 });
  }

  const updateData: Prisma.PotentialTenantUpdateInput = {};
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
  if (payload.phone !== undefined && payload.phone !== tenant.phone) {
    updateData.phone = payload.phone;
    proposedChanges.phone = payload.phone;
    changedFields.push("phone");
  }
  if (payload.interestedIn !== undefined && payload.interestedIn !== tenant.interestedIn) {
    updateData.interestedIn = payload.interestedIn;
    proposedChanges.interestedIn = payload.interestedIn;
    changedFields.push("interested in");
  }
  if (payload.budget !== undefined && payload.budget !== tenant.budget) {
    updateData.budget = payload.budget;
    proposedChanges.budget = payload.budget;
    changedFields.push("budget");
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
        entityType: ApprovalEntityType.POTENTIAL_TENANT,
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
        potentialTenant: {
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
    const result = await tx.potentialTenant.update({
      where: { id: tenant.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        interestedIn: true,
        budget: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        addedByAgentId: true,
        addedByAgent: { select: { id: true, agentDisplayName: true, email: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "POTENTIAL_TENANT",
        entityId: tenant.id,
        action: "UPDATE_POTENTIAL_TENANT",
        metadata: { fullName: tenant.fullName },
        beforeJson: tenant as unknown as Prisma.InputJsonValue,
        afterJson: result as unknown as Prisma.InputJsonValue,
      },
    });

    return result;
  });

  return NextResponse.json({
    potentialTenant: {
      ...updated,
      canEdit: true,
    },
  });
}
