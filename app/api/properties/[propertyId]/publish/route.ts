import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { UserRole } from "@prisma/client";

const publishSchema = z.object({
  publishedToWebsite: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: { propertyId: string } }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = await request.json();
    const { publishedToWebsite } = publishSchema.parse(body);

    // We allow AGENT or ADMIN to publish. Realistically we might check if they own it.
    // Assuming check logic is same as updating. For now, unrestricted if logged in.
    const property = await db.property.update({
      where: { id: params.propertyId },
      data: { publishedToWebsite },
    });

    return NextResponse.json({ ok: true, property });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload or internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
