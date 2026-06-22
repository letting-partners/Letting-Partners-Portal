import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID_REQUIRED", message: "Provide ?id=" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({
    where: { id },
    select: { id: true, fullName: true, saleId: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Tenant not found." }, { status: 404 });
  }

  await db.$transaction([
    db.tenant.delete({ where: { id: tenant.id } }),
    db.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "TENANT",
        entityId: tenant.id,
        action: "DELETE_TENANT",
        metadata: { fullName: tenant.fullName, saleId: tenant.saleId },
        beforeJson: tenant,
        afterJson: Prisma.JsonNull,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
