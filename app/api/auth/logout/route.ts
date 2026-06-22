import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { clearAuthSessionCookie, requireRole, requireUser } from "@/server/auth";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  await clearAuthSessionCookie();
  return NextResponse.json({ ok: true });
}
