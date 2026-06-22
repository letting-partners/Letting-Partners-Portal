import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const status = searchParams.get("status");

  const records = await db.callRecord.findMany({
    where: {
      ...(agentId ? { agentId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
        },
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phoneNumber: true,
      status: true,
      notes: true,
      createdAt: true,
      convertedToLandlordId: true,
      convertedToTenantId: true,
      convertedLandlord: { select: { id: true, landlordName: true } },
      convertedTenant: { select: { id: true, fullName: true } },
      agent: { select: { id: true, agentDisplayName: true, email: true } },
    },
  });

  return NextResponse.json({ records });
}
