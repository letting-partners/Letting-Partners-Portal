import { Prisma, PropertyStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const listSalesQuerySchema = z
  .object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    agent: z.string().trim().min(1).optional(),
    status: z.nativeEnum(PropertyStatus).optional(),
    city: z.string().trim().min(1).optional(),
    postcode: z.string().trim().min(1).optional(),
    format: z.enum(["json", "csv"]).default("json"),
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

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function escapeCsv(value: string | number | null): string {
  if (value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const queryParse = listSalesQuerySchema.safeParse({
    dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
    dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
    agent: request.nextUrl.searchParams.get("agent") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    city: request.nextUrl.searchParams.get("city") ?? undefined,
    postcode: request.nextUrl.searchParams.get("postcode") ?? undefined,
    format: request.nextUrl.searchParams.get("format") ?? "json",
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

  const { dateFrom, dateTo, agent, status, city, postcode, format, page, pageSize } = queryParse.data;
  const where: Prisma.SaleWhereInput = {};

  if (dateFrom || dateTo) {
    const closedAt: Prisma.DateTimeFilter = {};
    if (dateFrom) closedAt.gte = dateFrom;
    if (dateTo) {
      const inclusiveDateTo = new Date(dateTo);
      inclusiveDateTo.setHours(23, 59, 59, 999);
      closedAt.lte = inclusiveDateTo;
    }
    where.closedAt = closedAt;
  }

  if (status || city || postcode) {
    where.property = {
      is: {
        ...(status ? { status } : {}),
        ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
        ...(postcode ? { postcode: { contains: postcode, mode: "insensitive" as const } } : {}),
      },
    };
  }

  if (auth.user.role === "AGENT") {
    where.property = {
      is: {
        ownerAgentId: auth.user.id,
        ...(where.property?.is ?? {}),
      },
    };
  } else if (agent) {
    where.property = {
      is: {
        ...(where.property?.is ?? {}),
        ownerAgent: {
          is: {
            OR: [
              { id: agent },
              { email: { contains: agent, mode: "insensitive" as const } },
              { agentDisplayName: { contains: agent, mode: "insensitive" as const } },
            ],
          },
        },
      },
    };
  }

  const select = {
    id: true,
    propertyId: true,
    closedByUserId: true,
    finalAmount: true,
    commissionPct: true,
    commissionAmount: true,
    otherCosts: true,
    profit: true,
    closedAt: true,
    property: {
      select: {
        id: true,
        propertyRef: true,
        status: true,
        city: true,
        postcode: true,
        ownerAgentId: true,
        ownerAgent: {
          select: {
            id: true,
            agentDisplayName: true,
            email: true,
          },
        },
        landlord: {
          select: {
            id: true,
            landlordName: true,
            phoneLast10: true,
          },
        },
      },
    },
  } satisfies Prisma.SaleSelect;

  if (format === "csv") {
    const sales = await db.sale.findMany({
      where,
      orderBy: [{ closedAt: "desc" }, { id: "desc" }],
      take: 10000,
      select,
    });

    const header = [
      "saleId",
      "closedAt",
      "finalAmount",
      "commissionPct",
      "commissionAmount",
      "otherCosts",
      "profit",
      "propertyRef",
      "propertyStatus",
      "city",
      "postcode",
      "landlordName",
      "landlordPhoneLast10",
      "ownerAgentName",
      "ownerAgentEmail",
    ];
    const rows = sales.map((sale) =>
      [
        sale.id,
        sale.closedAt.toISOString(),
        decimalToNumber(sale.finalAmount),
        decimalToNumber(sale.commissionPct),
        decimalToNumber(sale.commissionAmount),
        decimalToNumber(sale.otherCosts),
        decimalToNumber(sale.profit),
        sale.property.propertyRef,
        sale.property.status,
        sale.property.city,
        sale.property.postcode,
        sale.property.landlord.landlordName,
        sale.property.landlord.phoneLast10,
        sale.property.ownerAgent.agentDisplayName,
        sale.property.ownerAgent.email,
      ]
        .map(escapeCsv)
        .join(","),
    );

    const csv = [header.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="sales-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const skip = (page - 1) * pageSize;
  const [total, sales, totals] = await db.$transaction([
    db.sale.count({ where }),
    db.sale.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ closedAt: "desc" }, { id: "desc" }],
      select,
    }),
    db.sale.aggregate({
      where,
      _sum: {
        finalAmount: true,
        commissionAmount: true,
        profit: true,
      },
    }),
  ]);

  return NextResponse.json({
    sales,
    totals: {
      finalAmount: decimalToNumber(totals._sum.finalAmount),
      commissionAmount: decimalToNumber(totals._sum.commissionAmount),
      profit: decimalToNumber(totals._sum.profit),
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
}
