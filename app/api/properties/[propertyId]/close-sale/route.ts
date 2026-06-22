import { PropertyStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { canEditProperty } from "@/server/policies";

const propertyIdSchema = z.string().uuid("property id must be a valid UUID");

const closeSaleSchema = z.object({
  finalAmount: z.coerce.number().positive("finalAmount must be > 0"),
  commissionPct: z.coerce.number().min(0, "commissionPct must be >= 0").max(9999),
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
    // V2 fields
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

type Params = {
  params: {
    propertyId: string;
  };
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const idParse = propertyIdSchema.safeParse(params.propertyId);
  if (!idParse.success) {
    return NextResponse.json(
      {
        error: "INVALID_PROPERTY_ID",
        message: idParse.error.issues[0]?.message ?? "Invalid property id.",
      },
      { status: 400 },
    );
  }

  let payload: z.infer<typeof closeSaleSchema>;
  try {
    payload = closeSaleSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid close-sale payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const property = await db.property.findUnique({
    where: { id: idParse.data },
    select: {
      id: true,
      landlordId: true,
      ownerAgentId: true,
      status: true,
      vacancyType: true,
      landlord: {
        select: {
          id: true,
          ownerAgentId: true,
          phoneLast10: true,
        },
      },
      sales: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!property) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Property not found." }, { status: 404 });
  }

  if (
    !canEditProperty(auth.user, {
      ownerAgentId: property.ownerAgentId,
      landlordOwnerAgentId: property.landlord.ownerAgentId,
    })
  ) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Only the owner agent or admin can close this sale.",
      },
      { status: 403 },
    );
  }

  if (property.vacancyType === "MULTIPLE") {
    return NextResponse.json(
      {
        error: "USE_ROOM_CLOSE",
        message: "This property has multiple vacancies. Use the room-level close endpoint.",
      },
      { status: 400 },
    );
  }

  if (property.sales.length > 0) {
    return NextResponse.json(
      {
        error: "SALE_ALREADY_EXISTS",
        message: "This property already has a final sale record.",
      },
      { status: 409 },
    );
  }

  const closableStatuses: PropertyStatus[] = ["AVAILABLE", "DRAFT"];
  if (!closableStatuses.includes(property.status)) {
    return NextResponse.json(
      {
        error: "INVALID_PROPERTY_STATUS",
        message: "Property must be AVAILABLE or DRAFT to close sale.",
      },
      { status: 400 },
    );
  }

  const finalAmount = round2(payload.finalAmount);
  const commissionPct = round2(payload.commissionPct);
  const otherCosts = round2(payload.otherCosts ?? 0);
  const commissionAmount = round2(finalAmount * (commissionPct / 100));
  const profit = round2(commissionAmount - otherCosts);

  const result = await db.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        propertyId: property.id,
        closedByUserId: auth.user.id,
        finalAmount,
        commissionPct,
        commissionAmount,
        otherCosts,
        profit,
      },
      select: {
        id: true,
        propertyId: true,
        closedByUserId: true,
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
        currentLivingPostcode: payload.tenant.currentLivingPostcode
          ? payload.tenant.currentLivingPostcode.toUpperCase()
          : null,
        workplacePostcode: payload.tenant.workplacePostcode
          ? payload.tenant.workplacePostcode.toUpperCase()
          : null,
        maximumBudget: payload.tenant.maximumBudget ?? null,
        workingProfession: payload.tenant.workingProfession?.trim() || null,
        immigrationStatus: payload.tenant.immigrationStatus?.trim() || null,
      },
      select: {
        id: true,
        saleId: true,
        fullName: true,
        email: true,
        phone: true,
        currentAddress: true,
        moveInDate: true,
        rentAmount: true,
        depositAmount: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.property.update({
      where: { id: property.id },
      data: { status: "CLOSED" },
    });

    // Reactivate landlord if it was passive
    await tx.landlord.updateMany({
      where: { id: property.landlord.id, isPassive: true },
      data: { isPassive: false, passiveMarkedAt: null },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "PROPERTY",
        entityId: property.id,
        action: "CLOSE_SALE",
        metadata: {
          landlordId: property.landlordId,
          phoneLast10: property.landlord.phoneLast10,
          finalAmount,
          commissionPct,
          commissionAmount,
          otherCosts,
          profit,
          tenantId: tenant.id,
          tenantFullName: tenant.fullName,
        },
        beforeJson: {
          status: property.status,
          sale: null,
        },
        afterJson: {
          status: "CLOSED",
          sale,
          tenant,
        },
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

    return { sale, tenant };
  });

  return NextResponse.json({ sale: result.sale, tenant: result.tenant }, { status: 201 });
}
