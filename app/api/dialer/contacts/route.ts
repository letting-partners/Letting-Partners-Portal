import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const contactSchema = z
  .object({
    fullName: z.string().trim().min(2, "fullName is required").max(120),
    phoneNumber: z.string().trim().min(2, "phoneNumber is required").max(40),
    extensionNumber: z.preprocess(normalizeOptionalText, z.string().max(40).nullable().optional()),
    email: z.preprocess(normalizeOptionalText, z.string().email().max(255).nullable().optional()),
    notes: z.preprocess(normalizeOptionalText, z.string().max(1000).nullable().optional()),
    isFavorite: z.boolean().optional(),
    labelIds: z.array(z.string().uuid()).max(20).optional().default([]),
  })
  .strict();

const querySchema = z
  .object({
    search: z.string().trim().min(1).optional(),
    labelId: z.string().uuid().optional(),
  })
  .strict();

function mapContact(contact: {
  id: string;
  fullName: string;
  phoneNumber: string;
  extensionNumber: string | null;
  email: string | null;
  notes: string | null;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  labels: Array<{
    label: {
      id: string;
      name: string;
      colorHex: string;
    };
  }>;
}) {
  return {
    id: contact.id,
    fullName: contact.fullName,
    phoneNumber: contact.phoneNumber,
    extensionNumber: contact.extensionNumber,
    email: contact.email,
    notes: contact.notes,
    isFavorite: contact.isFavorite,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    labels: contact.labels.map((item) => item.label),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const parse = querySchema.safeParse({
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    labelId: request.nextUrl.searchParams.get("labelId") ?? undefined,
  });
  if (!parse.success) {
    return NextResponse.json(
      {
        error: "INVALID_QUERY",
        message: "Invalid query parameters.",
        details: parse.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { search, labelId } = parse.data;
  const contacts = await db.dialerContact.findMany({
    where: {
      ownerUserId: auth.user.id,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { phoneNumber: { contains: search, mode: "insensitive" as const } },
              { extensionNumber: { contains: search, mode: "insensitive" as const } },
              { notes: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(labelId ? { labels: { some: { labelId } } } : {}),
    },
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      extensionNumber: true,
      email: true,
      notes: true,
      isFavorite: true,
      createdAt: true,
      updatedAt: true,
      labels: {
        orderBy: { label: { name: "asc" } },
        select: {
          label: {
            select: {
              id: true,
              name: true,
              colorHex: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    contacts: contacts.map(mapContact),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  let payload: z.infer<typeof contactSchema>;
  try {
    payload = contactSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid dialer contact payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  if (payload.labelIds.length > 0) {
    const count = await db.dialerContactLabel.count({
      where: {
        id: { in: payload.labelIds },
        ownerUserId: auth.user.id,
      },
    });
    if (count !== payload.labelIds.length) {
      return NextResponse.json(
        {
          error: "INVALID_LABEL_IDS",
          message: "One or more labels do not exist or are not accessible.",
        },
        { status: 400 },
      );
    }
  }

  const contact = await db.$transaction(async (tx) => {
    const created = await tx.dialerContact.create({
      data: {
        ownerUserId: auth.user.id,
        fullName: payload.fullName.trim(),
        phoneNumber: payload.phoneNumber.trim(),
        extensionNumber: payload.extensionNumber ?? null,
        email: payload.email ? payload.email.toLowerCase() : null,
        notes: payload.notes ?? null,
        isFavorite: payload.isFavorite ?? false,
        labels: payload.labelIds.length
          ? {
              createMany: {
                data: payload.labelIds.map((labelId) => ({ labelId })),
              },
            }
          : undefined,
      },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        extensionNumber: true,
        email: true,
        notes: true,
        isFavorite: true,
        createdAt: true,
        updatedAt: true,
        labels: {
          orderBy: { label: { name: "asc" } },
          select: {
            label: {
              select: {
                id: true,
                name: true,
                colorHex: true,
              },
            },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "DIALER_CONTACT",
        entityId: created.id,
        action: "DIALER_CONTACT_CREATE",
        beforeJson: Prisma.JsonNull,
        afterJson: {
          id: created.id,
          fullName: created.fullName,
          phoneNumber: created.phoneNumber,
          extensionNumber: created.extensionNumber,
          labelIds: payload.labelIds,
        },
      },
    });

    return created;
  });

  return NextResponse.json(
    {
      message: "Contact created.",
      contact: mapContact(contact),
    },
    { status: 201 },
  );
}
