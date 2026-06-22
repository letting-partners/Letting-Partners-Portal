import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const listAuditQuerySchema = z
  .object({
    entityType: z.string().trim().min(1).optional(),
    action: z.string().trim().min(1).optional(),
    user: z.string().trim().min(1).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dateFrom must be before or equal to dateTo",
      });
    }
  });

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const queryParse = listAuditQuerySchema.safeParse({
    entityType: request.nextUrl.searchParams.get("entityType") ?? undefined,
    action: request.nextUrl.searchParams.get("action") ?? undefined,
    user: request.nextUrl.searchParams.get("user") ?? undefined,
    dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
    dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
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

  const { entityType, action, user, dateFrom, dateTo, page, pageSize } = queryParse.data;
  const where: Prisma.AuditLogWhereInput = {};

  if (entityType) {
    where.entityType = { contains: entityType, mode: "insensitive" as const };
  }

  if (action) {
    where.action = { contains: action, mode: "insensitive" as const };
  }

  if (user) {
    where.user = {
      is: {
        OR: [
          { id: { equals: user } },
          { email: { contains: user, mode: "insensitive" as const } },
          { agentDisplayName: { contains: user, mode: "insensitive" as const } },
        ],
      },
    };
  }

  if (dateFrom || dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (dateFrom) {
      createdAt.gte = dateFrom;
    }
    if (dateTo) {
      const inclusiveDateTo = new Date(dateTo);
      inclusiveDateTo.setHours(23, 59, 59, 999);
      createdAt.lte = inclusiveDateTo;
    }
    where.createdAt = createdAt;
  }

  const skip = (page - 1) * pageSize;
  const [total, logs] = await db.$transaction([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        metadata: true,
        beforeJson: true,
        afterJson: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            agentDisplayName: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
}
