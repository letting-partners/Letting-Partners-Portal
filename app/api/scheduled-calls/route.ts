import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { UserRole } from "@prisma/client";

const createSchema = z.object({
  phoneNumber: z.string().trim().min(1, "Phone number is required"),
  contactName: z.string().trim().min(1).optional().or(z.literal("")).transform((v) => v || null),
  scheduledAt: z.string().datetime("scheduledAt must be a valid ISO datetime"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")).transform((v) => v || null),
});

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status"); // PENDING | DONE | CANCELLED | MISSED

  const calls = await db.scheduledCall.findMany({
    where: {
      agentId: auth.user.id,
      ...(statusFilter ? { status: statusFilter as never } : {}),
    },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json({ calls });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Invalid payload.", details: error instanceof z.ZodError ? error.flatten() : undefined },
      { status: 400 },
    );
  }

  const call = await db.scheduledCall.create({
    data: {
      agentId: auth.user.id,
      phoneNumber: payload.phoneNumber,
      contactName: payload.contactName ?? null,
      scheduledAt: new Date(payload.scheduledAt),
      notes: payload.notes ?? null,
      status: "PENDING",
    },
  });

  return NextResponse.json({ call }, { status: 201 });
}
