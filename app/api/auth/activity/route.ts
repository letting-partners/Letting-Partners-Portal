import { NextRequest, NextResponse } from "next/server";
import { getAuthSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";

export async function POST(request: NextRequest) {
  const session = getAuthSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  await db.user.updateMany({
    where: {
      id: session.userId,
      isActive: true,
    },
    data: {
      lastActivityAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
