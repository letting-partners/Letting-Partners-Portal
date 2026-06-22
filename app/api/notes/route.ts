import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { UserRole } from "@prisma/client";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200).optional().or(z.literal("")).transform((v) => v || null),
  content: z.string().trim().min(1, "Note content is required").max(10000),
  isPinned: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const notes = await db.agentNote.findMany({
    where: { agentId: auth.user.id },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ notes });
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

  const note = await db.agentNote.create({
    data: {
      agentId: auth.user.id,
      title: payload.title ?? null,
      content: payload.content,
      isPinned: payload.isPinned,
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}
