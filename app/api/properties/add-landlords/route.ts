import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import { db } from "@/server/db";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

  const where: Record<string, unknown> = { ownerAgentId: auth.user.id };
  if (search) {
    where.OR = [
      { landlordName: { contains: search, mode: "insensitive" as const } },
      { phoneLast10: { contains: search, mode: "insensitive" as const } },
      { landlordNumber: { contains: search, mode: "insensitive" as const } },
    ];
  }

  const landlords = await db.landlord.findMany({
    where,
    orderBy: { landlordName: "asc" },
    take: 100,
    select: {
      id: true,
      landlordName: true,
      landlordNumber: true,
      phoneLast10: true,
      email: true,
      isPassive: true,
      _count: { select: { properties: true } },
    },
  });

  return NextResponse.json({ landlords });
}
