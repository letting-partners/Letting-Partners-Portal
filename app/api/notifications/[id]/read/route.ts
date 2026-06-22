import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  const notification = await db.notification.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });

  if (!notification || notification.userId !== auth.user.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await db.notification.update({
    where: { id: params.id },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
