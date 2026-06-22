import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const { cleared } = await db.$transaction(async (tx) => {
    const saleCount = await tx.sale.count();

    // Deleting Sale also cascade-deletes linked Tenant records (schema: Tenant.sale onDelete: Cascade)
    await tx.sale.deleteMany({});

    // Reopen CLOSED properties
    await tx.property.updateMany({
      where: { status: "CLOSED" },
      data: { status: "AVAILABLE" },
    });

    // Reopen CLOSED rooms
    await tx.propertyRoom.updateMany({
      where: { status: "CLOSED" },
      data: { status: "AVAILABLE" },
    });

    return { cleared: saleCount };
  });

  return NextResponse.json({
    ok: true,
    message: `Cleared ${cleared} sale${cleared !== 1 ? "s" : ""}. Affected properties and rooms reset to Available.`,
    cleared,
  });
}