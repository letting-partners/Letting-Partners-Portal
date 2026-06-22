import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { normalizeUkPhone } from "@/server/phone";

const createTenantSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),
    phone: z.string().trim().min(1, "Phone number is required"),
    email: z.string().trim().email().nullable().optional().or(z.literal("").transform(() => null)),
    currentAddress: z.string().trim().min(1).nullable().optional(),
    moveInDate: z.string().datetime({ offset: true }).nullable().optional().or(z.string().date().nullable().optional()),
    rentAmount: z.coerce.number().min(0).nullable().optional(),
    depositAmount: z.coerce.number().min(0).nullable().optional(),
    notes: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const listTenantsQuerySchema = z
  .object({
    search: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const parsedQuery = listTenantsQuerySchema.safeParse({
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: "INVALID_QUERY",
        message: "Invalid tenant query parameters.",
        details: parsedQuery.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { page, pageSize, search } = parsedQuery.data;

  const where: Prisma.TenantWhereInput =
    auth.user.role === "ADMIN"
      ? {}
      : {
          OR: [
            { sale: { property: { ownerAgentId: auth.user.id } } },
            { addedByAgentId: auth.user.id, saleId: null },
          ],
        };

  if (search) {
    const searchFilters: Prisma.TenantWhereInput[] = [
      { fullName: { contains: search, mode: "insensitive" as const } },
      { email: { contains: search, mode: "insensitive" as const } },
      { phone: { contains: search, mode: "insensitive" as const } },
      { phoneLast10: { contains: search, mode: "insensitive" as const } },
      { notes: { contains: search, mode: "insensitive" as const } },
      {
        sale: {
          is: {
            property: {
              OR: [
                { propertyRef: { contains: search, mode: "insensitive" as const } },
                { addressLine1: { contains: search, mode: "insensitive" as const } },
                { postcode: { contains: search, mode: "insensitive" as const } },
                { landlord: { landlordName: { contains: search, mode: "insensitive" as const } } },
                { ownerAgent: { agentDisplayName: { contains: search, mode: "insensitive" as const } } },
              ],
            },
          },
        },
      },
      {
        addedByAgent: {
          is: {
            OR: [
              { agentDisplayName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          },
        },
      },
    ];

    if ("OR" in where && Array.isArray(where.OR)) {
      where.AND = [{ OR: where.OR }, { OR: searchFilters }];
      delete where.OR;
    } else {
      where.OR = searchFilters;
    }
  }

  const skip = (page - 1) * pageSize;

  const [total, tenants] = await db.$transaction([
    db.tenant.count({ where }),
    db.tenant.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
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
        saleId: true,
        addedByAgentId: true,
        addedByAgent: {
          select: { id: true, agentDisplayName: true, email: true },
        },
        sale: {
          select: {
            id: true,
            property: {
              select: {
                id: true,
                propertyRef: true,
                addressLine1: true,
                city: true,
                postcode: true,
                landlord: { select: { id: true, landlordName: true } },
                ownerAgent: { select: { id: true, agentDisplayName: true, email: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    tenants,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  let payload: z.infer<typeof createTenantSchema>;
  try {
    payload = createTenantSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Invalid tenant payload.", details: error instanceof z.ZodError ? error.flatten() : undefined },
      { status: 400 },
    );
  }

  const normalized = normalizeUkPhone(payload.phone);
  if (!normalized.ok) {
    return NextResponse.json(
      { error: "INVALID_PHONE", message: normalized.message },
      { status: 400 },
    );
  }

  // Check for existing tenant with same phone (last 10 digits) — globally unique
  const existing = await db.tenant.findFirst({
    where: { phoneLast10: normalized.phoneLast10 },
    select: { id: true, fullName: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: "TENANT_PHONE_CONFLICT",
        message: `A tenant with this phone number already exists (${existing.fullName}).`,
        existing,
      },
      { status: 409 },
    );
  }

  const tenant = await db.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        fullName: payload.fullName,
        phone: payload.phone.trim(),
        phoneLast10: normalized.phoneLast10,
        email: payload.email ?? null,
        currentAddress: payload.currentAddress ?? null,
        moveInDate: payload.moveInDate ? new Date(payload.moveInDate) : null,
        rentAmount: payload.rentAmount ?? null,
        depositAmount: payload.depositAmount ?? null,
        notes: payload.notes ?? null,
        addedByAgentId: auth.user.id,
      },
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
        entityId: created.id,
        action: "CREATE_TENANT",
        metadata: { phoneLast10: normalized.phoneLast10, addedByAgentId: auth.user.id },
        beforeJson: Prisma.JsonNull,
        afterJson: created,
      },
    });

    return created;
  });

  return NextResponse.json({ tenant }, { status: 201 });
}
