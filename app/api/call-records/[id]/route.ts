import { CallRecordStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const updateCallRecordSchema = z.object({
  status: z.nativeEnum(CallRecordStatus).optional(),
  notes: z.string().trim().nullable().optional(),
  convertedToLandlordId: z.string().uuid().nullable().optional(),
  convertedToTenantId: z.string().uuid().nullable().optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const existing = await db.callRecord.findUnique({
    where: { id: params.id },
    select: { id: true, agentId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Call record not found." }, { status: 404 });
  }

  if (auth.user.role !== "ADMIN" && existing.agentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "You cannot edit this record." }, { status: 403 });
  }

  let payload: z.infer<typeof updateCallRecordSchema>;
  try {
    payload = updateCallRecordSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Invalid update payload.", details: error instanceof z.ZodError ? error.flatten() : undefined },
      { status: 400 },
    );
  }

  const record = await db.callRecord.update({
    where: { id: params.id },
    data: {
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.convertedToLandlordId !== undefined ? { convertedToLandlordId: payload.convertedToLandlordId } : {}),
      ...(payload.convertedToTenantId !== undefined ? { convertedToTenantId: payload.convertedToTenantId } : {}),
    },
    select: {
      id: true,
      phoneNumber: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      convertedToLandlordId: true,
      convertedToTenantId: true,
      convertedLandlord: { select: { id: true, landlordName: true } },
      convertedTenant: { select: { id: true, fullName: true } },
    },
  });

  return NextResponse.json({ record });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const existing = await db.callRecord.findUnique({
    where: { id: params.id },
    select: { id: true, agentId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Call record not found." }, { status: 404 });
  }

  if (auth.user.role !== "ADMIN" && existing.agentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "You cannot delete this record." }, { status: 403 });
  }

  await db.callRecord.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
