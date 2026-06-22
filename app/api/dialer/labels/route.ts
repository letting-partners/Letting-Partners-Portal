import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const createLabelSchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(40),
    colorHex: z
      .string()
      .trim()
      .regex(/^#([A-Fa-f0-9]{6})$/, "colorHex must be a valid hex color")
      .optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const labels = await db.dialerContactLabel.findMany({
    where: {
      ownerUserId: auth.user.id,
    },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      colorHex: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          contacts: true,
        },
      },
    },
  });

  return NextResponse.json({
    labels: labels.map((label) => ({
      id: label.id,
      name: label.name,
      colorHex: label.colorHex,
      createdAt: label.createdAt,
      updatedAt: label.updatedAt,
      contactsCount: label._count.contacts,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  let payload: z.infer<typeof createLabelSchema>;
  try {
    payload = createLabelSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid label payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const name = payload.name.trim();
  const colorHex = payload.colorHex?.toUpperCase() ?? "#C69A4B";

  try {
    const label = await db.$transaction(async (tx) => {
      const created = await tx.dialerContactLabel.create({
        data: {
          ownerUserId: auth.user.id,
          name,
          colorHex,
        },
        select: {
          id: true,
          name: true,
          colorHex: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              contacts: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          entityType: "DIALER_LABEL",
          entityId: created.id,
          action: "DIALER_LABEL_CREATE",
          beforeJson: Prisma.JsonNull,
          afterJson: {
            id: created.id,
            name: created.name,
            colorHex: created.colorHex,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        message: "Label created.",
        label: {
          id: label.id,
          name: label.name,
          colorHex: label.colorHex,
          createdAt: label.createdAt,
          updatedAt: label.updatedAt,
          contactsCount: label._count.contacts,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "LABEL_NAME_EXISTS",
          message: "A label with this name already exists.",
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
