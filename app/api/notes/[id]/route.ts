import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { UserRole } from "@prisma/client";

const idSchema = z.string().uuid();

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional().nullable(),
    content: z.string().trim().min(1).max(10000).optional(),
    isPinned: z.boolean().optional(),
  })
  .strict();

type Params = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const idParse = idSchema.safeParse(params.id);
  if (!idParse.success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid note id." }, { status: 400 });
  }

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Invalid payload.", details: error instanceof z.ZodError ? error.flatten() : undefined },
      { status: 400 },
    );
  }

  const existing = await db.agentNote.findUnique({ where: { id: idParse.data } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Note not found." }, { status: 404 });
  }

  if (existing.agentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Access denied." }, { status: 403 });
  }

  const updated = await db.agentNote.update({
    where: { id: idParse.data },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.content !== undefined ? { content: payload.content } : {}),
      ...(payload.isPinned !== undefined ? { isPinned: payload.isPinned } : {}),
    },
  });

  return NextResponse.json({ note: updated });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const idParse = idSchema.safeParse(params.id);
  if (!idParse.success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid note id." }, { status: 400 });
  }

  const existing = await db.agentNote.findUnique({ where: { id: idParse.data } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Note not found." }, { status: 404 });
  }

  if (existing.agentId !== auth.user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Access denied." }, { status: 403 });
  }

  await db.agentNote.delete({ where: { id: idParse.data } });

  return NextResponse.json({ ok: true });
}
