import { ApprovalStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const listApprovalsQuerySchema = z.object({
  status: z.nativeEnum(ApprovalStatus).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const parsed = listApprovalsQuerySchema.safeParse({
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_QUERY",
        message: "Invalid approval query parameters.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { page, pageSize, search, status } = parsed.data;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { summary: { contains: search, mode: "insensitive" as const } },
            { requestedBy: { email: { contains: search, mode: "insensitive" as const } } },
            { requestedBy: { agentDisplayName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [total, approvals] = await db.$transaction([
    db.editApproval.count({ where }),
    db.editApproval.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        entityType: true,
        entityId: true,
        status: true,
        summary: true,
        beforeJson: true,
        proposedJson: true,
        reviewerNotes: true,
        createdAt: true,
        reviewedAt: true,
        requestedBy: {
          select: { id: true, email: true, agentDisplayName: true },
        },
        reviewedBy: {
          select: { id: true, email: true, agentDisplayName: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    approvals,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
}
