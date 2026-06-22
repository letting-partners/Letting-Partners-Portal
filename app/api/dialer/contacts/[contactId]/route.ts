import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const contactIdSchema = z.string().uuid("contactId must be a valid UUID");

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const patchContactSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phoneNumber: z.string().trim().min(2).max(40).optional(),
    extensionNumber: z.preprocess(normalizeOptionalText, z.string().max(40).nullable().optional()),
    email: z.preprocess(normalizeOptionalText, z.string().email().max(255).nullable().optional()),
    notes: z.preprocess(normalizeOptionalText, z.string().max(1000).nullable().optional()),
    isFavorite: z.boolean().optional(),
    labelIds: z.array(z.string().uuid()).max(20).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.fullName === undefined &&
      value.phoneNumber === undefined &&
      value.extensionNumber === undefined &&
      value.email === undefined &&
      value.notes === undefined &&
      value.isFavorite === undefined &&
      value.labelIds === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one update field is required.",
      });
    }
  });

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { contactId: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const contactIdParse = contactIdSchema.safeParse(params.contactId);
  if (!contactIdParse.success) {
    return NextResponse.json(
      {
        error: "INVALID_CONTACT_ID",
        message: contactIdParse.error.issues[0]?.message ?? "Invalid contact id.",
      },
      { status: 400 },
    );
  }

  let payload: z.infer<typeof patchContactSchema>;
  try {
    payload = patchContactSchema.parse(await request.json());
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

  const contact = await db.dialerContact.findFirst({
    where: {
      id: contactIdParse.data,
      ownerUserId: auth.user.id,
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
        select: {
          labelId: true,
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
  if (!contact) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Contact not found." }, { status: 404 });
  }

  if (payload.labelIds) {
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

  const updateData: Prisma.DialerContactUpdateInput = {};
  if (payload.fullName !== undefined) updateData.fullName = payload.fullName.trim();
  if (payload.phoneNumber !== undefined) updateData.phoneNumber = payload.phoneNumber.trim();
  if (payload.extensionNumber !== undefined) updateData.extensionNumber = payload.extensionNumber;
  if (payload.email !== undefined) {
    updateData.email = payload.email ? payload.email.toLowerCase() : null;
  }
  if (payload.notes !== undefined) updateData.notes = payload.notes;
  if (payload.isFavorite !== undefined) updateData.isFavorite = payload.isFavorite;

  const updated = await db.$transaction(async (tx) => {
    if (payload.labelIds) {
      await tx.dialerContactLabelOnContact.deleteMany({
        where: { contactId: contact.id },
      });
      if (payload.labelIds.length > 0) {
        await tx.dialerContactLabelOnContact.createMany({
          data: payload.labelIds.map((labelId) => ({
            contactId: contact.id,
            labelId,
          })),
        });
      }
    }

    const next = await tx.dialerContact.update({
      where: { id: contact.id },
      data: updateData,
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
        entityId: contact.id,
        action: "DIALER_CONTACT_UPDATE",
        beforeJson: {
          id: contact.id,
          fullName: contact.fullName,
          phoneNumber: contact.phoneNumber,
          extensionNumber: contact.extensionNumber,
          email: contact.email,
          notes: contact.notes,
          isFavorite: contact.isFavorite,
          labelIds: contact.labels.map((item) => item.labelId),
        },
        afterJson: {
          id: next.id,
          fullName: next.fullName,
          phoneNumber: next.phoneNumber,
          extensionNumber: next.extensionNumber,
          email: next.email,
          notes: next.notes,
          isFavorite: next.isFavorite,
          labelIds: next.labels.map((item) => item.label.id),
        },
      },
    });

    return next;
  });

  return NextResponse.json({
    message: "Contact updated.",
    contact: mapContact(updated),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { contactId: string } },
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const contactIdParse = contactIdSchema.safeParse(params.contactId);
  if (!contactIdParse.success) {
    return NextResponse.json(
      {
        error: "INVALID_CONTACT_ID",
        message: contactIdParse.error.issues[0]?.message ?? "Invalid contact id.",
      },
      { status: 400 },
    );
  }

  const contact = await db.dialerContact.findFirst({
    where: {
      id: contactIdParse.data,
      ownerUserId: auth.user.id,
    },
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      extensionNumber: true,
      email: true,
      notes: true,
      isFavorite: true,
      labels: {
        select: {
          labelId: true,
        },
      },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Contact not found." }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.dialerContact.delete({
      where: { id: contact.id },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "DIALER_CONTACT",
        entityId: contact.id,
        action: "DIALER_CONTACT_DELETE",
        beforeJson: {
          id: contact.id,
          fullName: contact.fullName,
          phoneNumber: contact.phoneNumber,
          extensionNumber: contact.extensionNumber,
          email: contact.email,
          notes: contact.notes,
          isFavorite: contact.isFavorite,
          labelIds: contact.labels.map((item) => item.labelId),
        },
        afterJson: Prisma.JsonNull,
      },
    });
  });

  return NextResponse.json({
    message: "Contact deleted.",
  });
}
