import { ApprovalEntityType, Prisma, PropertyStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import {
  canCreateProperty,
  canDeleteProperty,
  canEditProperty,
  canViewProperty,
} from "@/server/policies";
import { queueEditApproval } from "@/server/edit-approvals";
import {
  assertMediaAssetsExist,
  buildPropertyMediaRows,
  normalizeMediaAssetIds,
  serializePropertyImages,
} from "@/server/property-media";

const propertyIdSchema = z.string().uuid("property id must be a valid UUID");

const agentUpdateSchema = z
  .object({
    landlordId: z.string().uuid().optional(),
    propertyRef: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).max(200).nullable().optional(),
    description: z.string().trim().min(1).max(10000).nullable().optional(),
    addressLine1: z.string().trim().min(1).nullable().optional(),
    addressLine2: z.string().trim().min(1).nullable().optional(),
    city: z.string().trim().min(1).nullable().optional(),
    county: z.string().trim().min(1).nullable().optional(),
    postcode: z.string().trim().min(1).nullable().optional(),
    propertyType: z.string().trim().min(1).nullable().optional(),
    beds: z.coerce.number().int().min(0).nullable().optional(),
    baths: z.coerce.number().int().min(0).nullable().optional(),
    status: z.nativeEnum(PropertyStatus).optional(),
    landlordDemand: z.coerce.number().positive().nullable().optional(),
    expectedCommissionPct: z.coerce.number().min(0).max(100).nullable().optional(),
    expectedCommissionAmt: z.coerce.number().min(0).nullable().optional(),
    totalRooms: z.coerce.number().int().min(0).nullable().optional(),
    availableRooms: z.coerce.number().int().min(0).nullable().optional(),
    rentPerMonth: z.coerce.number().positive().nullable().optional(),
    depositAmount: z.coerce.number().min(0).nullable().optional(),
    isFurnished: z.boolean().nullable().optional(),
    personsAllowed: z.coerce.number().int().min(0).nullable().optional(),
    petsAllowed: z.boolean().nullable().optional(),
    dssAllowed: z.boolean().nullable().optional(),
    childrenAllowed: z.boolean().nullable().optional(),
    availabilityDate: z.string().datetime({ offset: true }).nullable().optional(),
    livingLandlord: z.boolean().nullable().optional(),
    mediaAssetIds: z.array(z.string().uuid()).max(50).optional(),
    mediaAssets: z
      .array(
        z.object({ id: z.string().uuid(), altText: z.string().max(500).trim().optional() }),
      )
      .max(50)
      .optional(),
  })
  .strict();

const adminUpdateSchema = agentUpdateSchema
  .extend({
    ownerAgentId: z.string().uuid().optional(),
  })
  .strict();

type Params = {
  params: {
    propertyId: string;
  };
};

const propertySelect = Prisma.validator<Prisma.PropertySelect>()({
  id: true,
  landlordId: true,
  ownerAgentId: true,
  propertyRef: true,
  title: true,
  description: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  county: true,
  postcode: true,
  propertyType: true,
  beds: true,
  baths: true,
  status: true,
  vacancyType: true,
  landlordDemand: true,
  expectedCommissionPct: true,
  expectedCommissionAmt: true,
  totalRooms: true,
  availableRooms: true,
  rentPerMonth: true,
  depositAmount: true,
  isFurnished: true,
  personsAllowed: true,
  petsAllowed: true,
  dssAllowed: true,
  childrenAllowed: true,
  availabilityDate: true,
  livingLandlord: true,
  createdAt: true,
  updatedAt: true,
  landlord: {
    select: {
      id: true,
      landlordName: true,
      phoneLast10: true,
      phoneE164: true,
      ownerAgentId: true,
    },
  },
  sales: {
    orderBy: [{ closedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      propertyId: true,
      roomId: true,
      closedByUserId: true,
      finalAmount: true,
      commissionPct: true,
      commissionAmount: true,
      otherCosts: true,
      profit: true,
      closedAt: true,
    },
  },
  mediaLinks: {
    orderBy: [{ sortOrder: "asc" }, { mediaAssetId: "asc" }],
    select: {
      sortOrder: true,
      altText: true,
      mediaAsset: {
        select: {
          id: true,
          name: true,
        },
      },
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
  },
});

export async function GET(request: NextRequest, { params }: Params) {
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

  const property = await db.property.findUnique({
    where: { id: idParse.data },
    select: propertySelect,
  });

  if (!property) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Property not found." }, { status: 404 });
  }

  if (
    !canViewProperty(auth.user, {
      ownerAgentId: property.ownerAgentId,
      landlordOwnerAgentId: property.landlord.ownerAgentId,
    })
  ) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Only the owner agent or admin can access this property.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ property: serializePropertyImages(property) });
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

  const currentProperty = await db.property.findUnique({
    where: { id: idParse.data },
    select: propertySelect,
  });

  if (!currentProperty) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Property not found." }, { status: 404 });
  }

  if (
    !canEditProperty(auth.user, {
      ownerAgentId: currentProperty.ownerAgentId,
      landlordOwnerAgentId: currentProperty.landlord.ownerAgentId,
    })
  ) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Only the owner agent or admin can update this property.",
      },
      { status: 403 },
    );
  }

  let payload: z.infer<typeof adminUpdateSchema>;
  try {
    payload =
      auth.user.role === "ADMIN"
        ? adminUpdateSchema.parse(await request.json())
        : agentUpdateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid property update payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const targetLandlordId = payload.landlordId ?? currentProperty.landlordId;
  const targetLandlord = await db.landlord.findUnique({
    where: { id: targetLandlordId },
    select: {
      id: true,
      ownerAgentId: true,
      landlordName: true,
      phoneLast10: true,
    },
  });

  if (!targetLandlord) {
    return NextResponse.json({ error: "LANDLORD_NOT_FOUND", message: "Landlord not found." }, { status: 404 });
  }

  const ownerAgentId =
    auth.user.role === "ADMIN"
      ? payload.ownerAgentId ?? currentProperty.ownerAgentId
      : currentProperty.ownerAgentId;
  const rawMediaAssets =
    payload.mediaAssets !== undefined
      ? payload.mediaAssets
      : payload.mediaAssetIds !== undefined
        ? payload.mediaAssetIds.map((id) => ({ id, altText: undefined }))
        : undefined;
  const normalizedMediaAssetIds =
    rawMediaAssets !== undefined
      ? normalizeMediaAssetIds(rawMediaAssets.map((a) => a.id))
      : undefined;
  const normalizedMediaAssets =
    rawMediaAssets !== undefined && normalizedMediaAssetIds !== undefined
      ? normalizedMediaAssetIds.map((id) => ({
          id,
          altText: rawMediaAssets.find((a) => a.id === id)?.altText,
        }))
      : undefined;

  if (
    !canCreateProperty(auth.user, {
      ownerAgentId,
      landlordOwnerAgentId: targetLandlord.ownerAgentId,
    })
  ) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Only the owner agent or admin can assign this ownership.",
      },
      { status: 403 },
    );
  }

  if (ownerAgentId !== targetLandlord.ownerAgentId) {
    return NextResponse.json(
      {
        error: "OWNER_MUST_MATCH_LANDLORD_OWNER",
        message: "ownerAgentId must match landlord.ownerAgentId.",
      },
      { status: 400 },
    );
  }

  if (normalizedMediaAssetIds !== undefined) {
    try {
      await assertMediaAssetsExist(db, normalizedMediaAssetIds);
    } catch (error) {
      if (error instanceof Error && error.message === "MEDIA_ASSET_NOT_FOUND") {
        return NextResponse.json(
          {
            error: "MEDIA_ASSET_NOT_FOUND",
            message: "One or more selected media items could not be found.",
          },
          { status: 400 },
        );
      }

      throw error;
    }
  }

  if (payload.status === "CLOSED" && currentProperty.sales.length === 0) {
    return NextResponse.json(
      {
        error: "SALE_REQUIRED",
        message:
          "Use POST /api/properties/:propertyId/close-sale to mark property as CLOSED with sale details.",
      },
      { status: 400 },
    );
  }

  const targetStatus = payload.status ?? currentProperty.status;
  if (targetStatus === "AVAILABLE") {
    const mergedDescription = payload.description !== undefined ? payload.description : currentProperty.description;
    const mergedAddress1 = payload.addressLine1 !== undefined ? payload.addressLine1 : currentProperty.addressLine1;
    const mergedPostcode = payload.postcode !== undefined ? payload.postcode : currentProperty.postcode;
    const mergedCity = payload.city !== undefined ? payload.city : currentProperty.city;
    const mergedAvailability = payload.availabilityDate !== undefined ? payload.availabilityDate : currentProperty.availabilityDate;
    const mergedMediaCount = normalizedMediaAssetIds !== undefined ? normalizedMediaAssetIds.length : currentProperty.mediaLinks.length;

    const missing: string[] = [];
    if (!mergedDescription) missing.push("description");
    if (!mergedAddress1) missing.push("address");
    if (!mergedPostcode) missing.push("postcode");
    if (!mergedCity) missing.push("city");
    if (!mergedAvailability) missing.push("availability date");
    if (mergedMediaCount === 0) missing.push("at least one photo");

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "INCOMPLETE_FOR_ACTIVE",
          message: `Cannot set status to AVAILABLE. Missing: ${missing.join(", ")}.`,
        },
        { status: 422 },
      );
    }
  }

  const updateData: Prisma.PropertyUncheckedUpdateInput = {};
  const proposedChanges: Record<string, unknown> = {};
  const changedFields: string[] = [];
  let hasChanges = false;

  if (payload.landlordId !== undefined && payload.landlordId !== currentProperty.landlordId) {
    updateData.landlordId = payload.landlordId;
    proposedChanges.landlordId = payload.landlordId;
    changedFields.push("landlord");
    hasChanges = true;
  }

  if (ownerAgentId !== currentProperty.ownerAgentId) {
    updateData.ownerAgentId = ownerAgentId;
    proposedChanges.ownerAgentId = ownerAgentId;
    changedFields.push("owner agent");
    hasChanges = true;
  }

  if (payload.propertyRef !== undefined && payload.propertyRef !== currentProperty.propertyRef) {
    updateData.propertyRef = payload.propertyRef;
    proposedChanges.propertyRef = payload.propertyRef;
    changedFields.push("reference");
    hasChanges = true;
  }
  if (payload.title !== undefined && payload.title !== currentProperty.title) {
    updateData.title = payload.title;
    proposedChanges.title = payload.title;
    changedFields.push("title");
    hasChanges = true;
  }
  if (payload.description !== undefined && payload.description !== currentProperty.description) {
    updateData.description = payload.description;
    proposedChanges.description = payload.description;
    changedFields.push("description");
    hasChanges = true;
  }
  if (payload.addressLine1 !== undefined && payload.addressLine1 !== currentProperty.addressLine1) {
    updateData.addressLine1 = payload.addressLine1;
    proposedChanges.addressLine1 = payload.addressLine1;
    changedFields.push("address line 1");
    hasChanges = true;
  }
  if (payload.addressLine2 !== undefined && payload.addressLine2 !== currentProperty.addressLine2) {
    updateData.addressLine2 = payload.addressLine2;
    proposedChanges.addressLine2 = payload.addressLine2;
    changedFields.push("address line 2");
    hasChanges = true;
  }
  if (payload.city !== undefined && payload.city !== currentProperty.city) {
    updateData.city = payload.city;
    proposedChanges.city = payload.city;
    changedFields.push("city");
    hasChanges = true;
  }
  if (payload.county !== undefined && payload.county !== currentProperty.county) {
    updateData.county = payload.county;
    proposedChanges.county = payload.county;
    changedFields.push("county");
    hasChanges = true;
  }
  if (payload.postcode !== undefined && payload.postcode !== currentProperty.postcode) {
    updateData.postcode = payload.postcode;
    proposedChanges.postcode = payload.postcode;
    changedFields.push("postcode");
    hasChanges = true;
  }
  if (payload.propertyType !== undefined && payload.propertyType !== currentProperty.propertyType) {
    updateData.propertyType = payload.propertyType;
    proposedChanges.propertyType = payload.propertyType;
    changedFields.push("property type");
    hasChanges = true;
  }
  if (payload.beds !== undefined && payload.beds !== currentProperty.beds) {
    updateData.beds = payload.beds;
    proposedChanges.beds = payload.beds;
    changedFields.push("beds");
    hasChanges = true;
  }
  if (payload.baths !== undefined && payload.baths !== currentProperty.baths) {
    updateData.baths = payload.baths;
    proposedChanges.baths = payload.baths;
    changedFields.push("baths");
    hasChanges = true;
  }
  if (payload.status !== undefined && payload.status !== currentProperty.status) {
    updateData.status = payload.status;
    proposedChanges.status = payload.status;
    changedFields.push("status");
    hasChanges = true;
  }
  if (
    payload.landlordDemand !== undefined &&
    String(payload.landlordDemand) !== String(currentProperty.landlordDemand)
  ) {
    updateData.landlordDemand = payload.landlordDemand;
    proposedChanges.landlordDemand = payload.landlordDemand;
    changedFields.push("landlord demand");
    hasChanges = true;
  }
  if (
    payload.expectedCommissionPct !== undefined &&
    String(payload.expectedCommissionPct) !== String(currentProperty.expectedCommissionPct)
  ) {
    updateData.expectedCommissionPct = payload.expectedCommissionPct;
    proposedChanges.expectedCommissionPct = payload.expectedCommissionPct;
    changedFields.push("expected commission %");
    hasChanges = true;
  }
  if (
    payload.expectedCommissionAmt !== undefined &&
    String(payload.expectedCommissionAmt) !== String(currentProperty.expectedCommissionAmt)
  ) {
    updateData.expectedCommissionAmt = payload.expectedCommissionAmt;
    proposedChanges.expectedCommissionAmt = payload.expectedCommissionAmt;
    changedFields.push("expected commission amount");
    hasChanges = true;
  }
  if (payload.totalRooms !== undefined && payload.totalRooms !== currentProperty.totalRooms) {
    updateData.totalRooms = payload.totalRooms;
    proposedChanges.totalRooms = payload.totalRooms;
    changedFields.push("total rooms");
    hasChanges = true;
  }
  if (payload.availableRooms !== undefined && payload.availableRooms !== currentProperty.availableRooms) {
    updateData.availableRooms = payload.availableRooms;
    proposedChanges.availableRooms = payload.availableRooms;
    changedFields.push("available rooms");
    hasChanges = true;
  }
  if (payload.rentPerMonth !== undefined && String(payload.rentPerMonth) !== String(currentProperty.rentPerMonth)) {
    updateData.rentPerMonth = payload.rentPerMonth;
    proposedChanges.rentPerMonth = payload.rentPerMonth;
    changedFields.push("rent per month");
    hasChanges = true;
  }
  if (payload.depositAmount !== undefined && String(payload.depositAmount) !== String(currentProperty.depositAmount)) {
    updateData.depositAmount = payload.depositAmount;
    proposedChanges.depositAmount = payload.depositAmount;
    changedFields.push("deposit amount");
    hasChanges = true;
  }
  if (payload.isFurnished !== undefined && payload.isFurnished !== currentProperty.isFurnished) {
    updateData.isFurnished = payload.isFurnished;
    proposedChanges.isFurnished = payload.isFurnished;
    changedFields.push("furnished status");
    hasChanges = true;
  }
  if (payload.personsAllowed !== undefined && payload.personsAllowed !== currentProperty.personsAllowed) {
    updateData.personsAllowed = payload.personsAllowed;
    proposedChanges.personsAllowed = payload.personsAllowed;
    changedFields.push("persons allowed");
    hasChanges = true;
  }
  if (payload.petsAllowed !== undefined && payload.petsAllowed !== currentProperty.petsAllowed) {
    updateData.petsAllowed = payload.petsAllowed;
    proposedChanges.petsAllowed = payload.petsAllowed;
    changedFields.push("pets allowed");
    hasChanges = true;
  }
  if (payload.dssAllowed !== undefined && payload.dssAllowed !== currentProperty.dssAllowed) {
    updateData.dssAllowed = payload.dssAllowed;
    proposedChanges.dssAllowed = payload.dssAllowed;
    changedFields.push("DSS allowed");
    hasChanges = true;
  }
  if (payload.childrenAllowed !== undefined && payload.childrenAllowed !== currentProperty.childrenAllowed) {
    updateData.childrenAllowed = payload.childrenAllowed;
    proposedChanges.childrenAllowed = payload.childrenAllowed;
    changedFields.push("children allowed");
    hasChanges = true;
  }
  if (
    payload.availabilityDate !== undefined &&
    (payload.availabilityDate === null
      ? currentProperty.availabilityDate !== null
      : String(payload.availabilityDate) !== String(currentProperty.availabilityDate))
  ) {
    updateData.availabilityDate = payload.availabilityDate ? new Date(payload.availabilityDate) : null;
    proposedChanges.availabilityDate = payload.availabilityDate ? new Date(payload.availabilityDate).toISOString() : null;
    changedFields.push("availability date");
    hasChanges = true;
  }
  if (payload.livingLandlord !== undefined && payload.livingLandlord !== currentProperty.livingLandlord) {
    updateData.livingLandlord = payload.livingLandlord;
    proposedChanges.livingLandlord = payload.livingLandlord;
    changedFields.push("living landlord");
    hasChanges = true;
  }
  if (normalizedMediaAssetIds !== undefined) {
    const currentMediaAssetIds = currentProperty.mediaLinks.map((link) => link.mediaAsset.id);
    const mediaChanged =
      currentMediaAssetIds.length !== normalizedMediaAssetIds.length ||
      currentMediaAssetIds.some((id, index) => id !== normalizedMediaAssetIds[index]);

    if (mediaChanged) {
      proposedChanges.mediaAssetIds = normalizedMediaAssetIds;
      changedFields.push("images");
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return NextResponse.json(
      {
        error: "NO_FIELDS_TO_UPDATE",
        message: "No effective property changes were provided.",
      },
      { status: 400 },
    );
  }

  if (auth.user.role === "AGENT") {
    const approval = await db.$transaction(async (tx) =>
      queueEditApproval({
        tx,
        entityType: ApprovalEntityType.PROPERTY,
        entityId: currentProperty.id,
        requestedById: auth.user.id,
        beforeJson: currentProperty as unknown as Prisma.InputJsonValue,
        proposedJson: proposedChanges as Prisma.InputJsonValue,
        changedFields,
        entityLabel: currentProperty.addressLine1 ?? currentProperty.propertyRef,
      }),
    );

    return NextResponse.json(
      {
        property: serializePropertyImages(currentProperty),
        approvalRequired: true,
        approvalRequest: approval,
        message: "Changes submitted for admin approval.",
      },
      { status: 202 },
    );
  }

  const property = await db.$transaction(async (tx) => {
    if (Object.keys(updateData).length > 0) {
      await tx.property.update({
        where: { id: currentProperty.id },
        data: updateData,
        select: { id: true },
      });
    }

    if (normalizedMediaAssetIds !== undefined) {
      await tx.propertyMedia.deleteMany({
        where: { propertyId: currentProperty.id },
      });

      if (normalizedMediaAssets && normalizedMediaAssets.length > 0) {
        await tx.propertyMedia.createMany({
          data: buildPropertyMediaRows(currentProperty.id, normalizedMediaAssets),
        });
      }
    }

    const updated = await tx.property.findUniqueOrThrow({
      where: { id: currentProperty.id },
      select: propertySelect,
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "PROPERTY",
        entityId: updated.id,
        action: "UPDATE_PROPERTY",
        metadata: {
          landlordId: updated.landlordId,
          ownerAgentId: updated.ownerAgentId,
          status: updated.status,
        },
        beforeJson: currentProperty,
        afterJson: updated,
      },
    });

    return updated;
  });

  return NextResponse.json({ property: serializePropertyImages(property) });
}

export async function DELETE(request: NextRequest, { params }: Params) {
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

  const currentProperty = await db.property.findUnique({
    where: { id: idParse.data },
    select: propertySelect,
  });

  if (!currentProperty) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Property not found." }, { status: 404 });
  }

  if (
    !canDeleteProperty(auth.user, {
      ownerAgentId: currentProperty.ownerAgentId,
      landlordOwnerAgentId: currentProperty.landlord.ownerAgentId,
    })
  ) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Only the owner agent or admin can delete this property.",
      },
      { status: 403 },
    );
  }

  await db.$transaction([
    db.property.delete({ where: { id: currentProperty.id } }),
    db.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "PROPERTY",
        entityId: currentProperty.id,
        action: "DELETE_PROPERTY",
        metadata: {
          landlordId: currentProperty.landlordId,
          ownerAgentId: currentProperty.ownerAgentId,
        },
        beforeJson: currentProperty,
        afterJson: Prisma.JsonNull,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
