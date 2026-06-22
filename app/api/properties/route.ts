import { Prisma, PropertyStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { canListProperties } from "@/server/policies";
import { serializePropertyImageList } from "@/server/property-media";

const listQuerySchema = z
  .object({
    search: z.string().trim().min(1).optional(),
    phoneLast10: z.string().trim().regex(/^\d{10}$/).optional(),
    propertyRef: z.string().trim().min(1).optional(),
    status: z.nativeEnum(PropertyStatus).optional(),
    city: z.string().trim().min(1).optional(),
    postcode: z.string().trim().min(1).optional(),
    createdAt: z.coerce.date().optional(),
    includeSOLD: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  if (!canListProperties(auth.user)) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "You do not have permission to list properties.",
      },
      { status: 403 },
    );
  }

  const parsedQuery = listQuerySchema.safeParse({
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    phoneLast10:
      request.nextUrl.searchParams.get("phoneLast10") ??
      request.nextUrl.searchParams.get("landlordNumber") ??
      undefined,
    propertyRef: request.nextUrl.searchParams.get("propertyRef") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    city: request.nextUrl.searchParams.get("city") ?? undefined,
    postcode: request.nextUrl.searchParams.get("postcode") ?? undefined,
    createdAt: request.nextUrl.searchParams.get("createdAt") ?? undefined,
    includeSOLD: request.nextUrl.searchParams.get("includeSOLD") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: "INVALID_QUERY",
        message: "Invalid query parameters.",
        details: parsedQuery.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { search, phoneLast10, propertyRef, status, city, postcode, createdAt, page, pageSize } =
    parsedQuery.data;
  const where: Prisma.PropertyWhereInput = {};

  if (phoneLast10) {
    where.landlord = {
      is: {
        phoneLast10: { contains: phoneLast10, mode: "insensitive" as const },
      },
    };
  }

  if (propertyRef) {
    where.propertyRef = { contains: propertyRef, mode: "insensitive" as const };
  }

  if (status) {
    where.status = status;
  }
  // No default filter — show all statuses including CLOSED

  if (city) {
    where.city = { contains: city, mode: "insensitive" as const };
  }

  if (postcode) {
    where.postcode = { contains: postcode, mode: "insensitive" as const };
  }

  if (createdAt) {
    const start = new Date(createdAt);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    where.createdAt = {
      gte: start,
      lt: end,
    };
  }

  if (auth.user.role === "AGENT") {
    where.ownerAgentId = auth.user.id;
  }

  if (search) {
    const searchFilters: Prisma.PropertyWhereInput[] = [
      { propertyRef: { contains: search, mode: "insensitive" as const } },
      { title: { contains: search, mode: "insensitive" as const } },
      { description: { contains: search, mode: "insensitive" as const } },
      { addressLine1: { contains: search, mode: "insensitive" as const } },
      { addressLine2: { contains: search, mode: "insensitive" as const } },
      { city: { contains: search, mode: "insensitive" as const } },
      { postcode: { contains: search, mode: "insensitive" as const } },
      { propertyType: { contains: search, mode: "insensitive" as const } },
      { landlord: { is: { landlordName: { contains: search, mode: "insensitive" as const } } } },
      {
        ownerAgent: {
          is: {
            OR: [
              { agentDisplayName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          },
        },
      },
    ];

    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [...existingAnd, { OR: searchFilters }];
  }

  const skip = (page - 1) * pageSize;

  const [total, properties] = await db.$transaction([
    db.property.count({ where }),
    db.property.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
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
        landlordDemand: true,
        expectedCommissionPct: true,
        createdAt: true,
        updatedAt: true,
        landlord: {
          select: {
            id: true,
            landlordName: true,
            phoneE164: true,
            phoneLast10: true,
            ownerAgentId: true,
          },
        },
        ownerAgent: {
          select: {
            id: true,
            agentDisplayName: true,
            email: true,
          },
        },
        vacancyType: true,
        mediaLinks: {
          orderBy: [{ sortOrder: "asc" }, { mediaAssetId: "asc" }],
          select: {
            mediaAsset: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sales: {
          select: {
            id: true,
            finalAmount: true,
            commissionPct: true,
            commissionAmount: true,
            otherCosts: true,
            profit: true,
            closedAt: true,
            roomId: true,
          },
        },
        rooms: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            roomName: true,
            landlordDemand: true,
            expectedCommissionPct: true,
            status: true,
            sale: {
              select: {
                id: true,
                finalAmount: true,
                closedAt: true,
                tenant: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    properties: serializePropertyImageList(properties),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "METHOD_NOT_ALLOWED",
      message:
        "Use POST /api/properties/intake (phone-first) or POST /api/landlords/:id/properties.",
    },
    { status: 405 },
  );
}
