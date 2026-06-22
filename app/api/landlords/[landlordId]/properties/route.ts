import { Prisma, PropertyStatus, UserRole, VacancyType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { canCreateProperty, canViewProperty } from "@/server/policies";
import {
  assertMediaAssetsExist,
  buildPropertyMediaRows,
  normalizeMediaAssetIds,
  serializePropertyImageList,
  serializePropertyImages,
} from "@/server/property-media";

const landlordIdSchema = z.string().uuid("landlord id must be a valid UUID");

const roomInputSchema = z
  .object({
    roomName: z.string().trim().min(1, "roomName is required"),
    landlordDemand: z.coerce.number().positive().nullable().optional(),
    expectedCommissionPct: z.coerce.number().min(0).max(9999).nullable().optional(),
  })
  .strict();

const createPropertySchema = z
  .object({
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
    vacancyType: z.nativeEnum(VacancyType).optional(),
    landlordDemand: z.coerce.number().positive().nullable().optional(),
    expectedCommissionPct: z.coerce.number().min(0).max(9999).nullable().optional(),
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
    rooms: z.array(roomInputSchema).max(200).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const vacancyType = value.vacancyType ?? "SINGLE";
    if (vacancyType === "MULTIPLE" && (!value.rooms || value.rooms.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one room is required for MULTIPLE vacancy properties.",
        path: ["rooms"],
      });
    }
  });

const listQuerySchema = z
  .object({
    propertyRef: z.string().trim().min(1).optional(),
    status: z.nativeEnum(PropertyStatus).optional(),
    city: z.string().trim().min(1).optional(),
    postcode: z.string().trim().min(1).optional(),
    createdAt: z.coerce.date().optional(),
  })
  .strict();

type Params = {
  params: {
    landlordId: string;
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
      tenant: {
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
          tenant: { select: { id: true, fullName: true } },
        },
      },
    },
  },
  mediaLinks: {
    orderBy: [{ sortOrder: "asc" }, { mediaAssetId: "asc" }],
    select: {
      sortOrder: true,
      mediaAsset: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
});

function generatePropertyRef(landlordId: string): string {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `PROP-${landlordId.slice(0, 4).toUpperCase()}-${suffix}`;
}

function normalizePropertyForCreate(payload: z.infer<typeof createPropertySchema>) {
  const vacancyType = payload.vacancyType ?? "SINGLE";
  const rooms =
    vacancyType === "MULTIPLE"
      ? (payload.rooms ?? []).map((room) => ({
          roomName: room.roomName.trim(),
          landlordDemand: room.landlordDemand ?? null,
          expectedCommissionPct: room.expectedCommissionPct ?? null,
        }))
      : [];

  return {
    vacancyType,
    landlordDemand: vacancyType === "SINGLE" ? payload.landlordDemand ?? null : null,
    expectedCommissionPct: vacancyType === "SINGLE" ? payload.expectedCommissionPct ?? null : null,
    expectedCommissionAmt: vacancyType === "SINGLE" ? payload.expectedCommissionAmt ?? null : null,
    rooms,
  };
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
      ownerAgentId: true,
      landlordName: true,
      phoneE164: true,
      phoneLast10: true,
      email: true,
    },
  });

  if (!landlord) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Landlord not found." }, { status: 404 });
  }

  if (
    !canViewProperty(auth.user, {
      ownerAgentId: landlord.ownerAgentId,
      landlordOwnerAgentId: landlord.ownerAgentId,
    })
  ) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Only the owner agent or admin can access landlord properties.",
      },
      { status: 403 },
    );
  }

  const queryParse = listQuerySchema.safeParse({
    propertyRef: request.nextUrl.searchParams.get("propertyRef") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    city: request.nextUrl.searchParams.get("city") ?? undefined,
    postcode: request.nextUrl.searchParams.get("postcode") ?? undefined,
    createdAt: request.nextUrl.searchParams.get("createdAt") ?? undefined,
  });

  if (!queryParse.success) {
    return NextResponse.json(
      {
        error: "INVALID_QUERY",
        message: "Invalid query parameters.",
        details: queryParse.error.flatten(),
      },
      { status: 400 },
    );
  }

  const where: Prisma.PropertyWhereInput = {
    landlordId: landlord.id,
  };

  if (queryParse.data.propertyRef) {
    where.propertyRef = { contains: queryParse.data.propertyRef, mode: "insensitive" as const };
  }
  if (queryParse.data.status) {
    where.status = queryParse.data.status;
  }
  if (queryParse.data.city) {
    where.city = { contains: queryParse.data.city, mode: "insensitive" as const };
  }
  if (queryParse.data.postcode) {
    where.postcode = { contains: queryParse.data.postcode, mode: "insensitive" as const };
  }

  if (queryParse.data.createdAt) {
    const start = new Date(queryParse.data.createdAt);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.createdAt = {
      gte: start,
      lt: end,
    };
  }

  const properties = await db.property.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: propertySelect,
  });

  return NextResponse.json({
    landlord: {
      id: landlord.id,
      fullName: landlord.landlordName,
      phoneE164: landlord.phoneE164,
      phoneLast10: landlord.phoneLast10,
      email: landlord.email,
      ownerAgentId: landlord.ownerAgentId,
    },
    properties: serializePropertyImageList(properties),
  });
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

  let payload: z.infer<typeof createPropertySchema>;
  try {
    payload = createPropertySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid property payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const landlord = await db.landlord.findUnique({
    where: { id: idParse.data },
    select: {
      id: true,
      ownerAgentId: true,
      phoneLast10: true,
      landlordName: true,
    },
  });

  if (!landlord) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Landlord not found." }, { status: 404 });
  }

  if (
    !canCreateProperty(auth.user, {
      ownerAgentId: landlord.ownerAgentId,
      landlordOwnerAgentId: landlord.ownerAgentId,
    })
  ) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Only the owner agent or admin can create properties for this landlord.",
      },
      { status: 403 },
    );
  }

  const propertyRef = payload.propertyRef?.trim() || generatePropertyRef(landlord.id);
  const normalized = normalizePropertyForCreate(payload);
  const mediaAssetIds = normalizeMediaAssetIds(payload.mediaAssetIds);

  try {
    await assertMediaAssetsExist(db, mediaAssetIds);
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

  const property = await db.$transaction(async (tx) => {
    const created = await tx.property.create({
      data: {
        landlordId: landlord.id,
        ownerAgentId: landlord.ownerAgentId,
        propertyRef,
        title: payload.title?.trim() || null,
        description: payload.description?.trim() || null,
        addressLine1: payload.addressLine1?.trim() || null,
        addressLine2: payload.addressLine2?.trim() || null,
        city: payload.city?.trim() || null,
        county: payload.county?.trim() || null,
        postcode: payload.postcode?.trim() || null,
        propertyType: payload.propertyType?.trim() || null,
        beds: payload.beds ?? null,
        baths: payload.baths ?? null,
        status: payload.status ?? "DRAFT",
        vacancyType: normalized.vacancyType,
        landlordDemand: normalized.landlordDemand,
        expectedCommissionPct: normalized.expectedCommissionPct,
        expectedCommissionAmt: normalized.expectedCommissionAmt,
        totalRooms: payload.totalRooms ?? null,
        availableRooms: payload.availableRooms ?? null,
        rentPerMonth: payload.rentPerMonth ?? null,
        depositAmount: payload.depositAmount ?? null,
        isFurnished: payload.isFurnished ?? null,
        personsAllowed: payload.personsAllowed ?? null,
        petsAllowed: payload.petsAllowed ?? null,
        dssAllowed: payload.dssAllowed ?? null,
        childrenAllowed: payload.childrenAllowed ?? null,
        availabilityDate: payload.availabilityDate ? new Date(payload.availabilityDate) : null,
        livingLandlord: payload.livingLandlord ?? null,
        rooms:
          normalized.vacancyType === "MULTIPLE"
            ? {
                create: normalized.rooms.map((room) => ({
                  roomName: room.roomName,
                  landlordDemand: room.landlordDemand,
                  expectedCommissionPct: room.expectedCommissionPct,
                })),
              }
            : undefined,
      },
      select: { id: true },
    });

    if (mediaAssetIds.length > 0) {
      await tx.propertyMedia.createMany({
        data: buildPropertyMediaRows(created.id, mediaAssetIds.map((id) => ({ id }))),
      });
    }

    const propertyWithImages = await tx.property.findUniqueOrThrow({
      where: { id: created.id },
      select: propertySelect,
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "PROPERTY",
        entityId: propertyWithImages.id,
        action: "CREATE_PROPERTY",
        metadata: {
          landlordId: landlord.id,
          ownerAgentId: landlord.ownerAgentId,
          phoneLast10: landlord.phoneLast10,
          vacancyType: propertyWithImages.vacancyType,
          roomsCount: propertyWithImages.rooms.length,
        },
        beforeJson: Prisma.JsonNull,
        afterJson: propertyWithImages,
      },
    });

    return propertyWithImages;
  });

  return NextResponse.json({ property: serializePropertyImages(property) }, { status: 201 });
}
