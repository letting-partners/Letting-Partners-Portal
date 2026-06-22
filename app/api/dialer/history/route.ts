import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const directionSchema = z.enum(["INCOMING", "OUTGOING", "INTERNAL"]);
const statusSchema = z.enum(["MISSED", "RINGING", "ANSWERED", "REJECTED", "COMPLETED", "FAILED"]);

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

const createCallSchema = z
  .object({
    direction: directionSchema,
    status: statusSchema.optional(),
    contactId: z.string().uuid().optional(),
    counterpartUserId: z.preprocess(normalizeOptionalText, z.string().uuid().nullable().optional()),
    peerName: z.preprocess(normalizeOptionalText, z.string().max(120).nullable().optional()),
    peerNumber: z.preprocess(normalizeOptionalText, z.string().max(40).nullable().optional()),
    peerExtension: z.preprocess(normalizeOptionalText, z.string().max(40).nullable().optional()),
    startedAt: z.preprocess(parseOptionalDate, z.date().nullable().optional()),
    answeredAt: z.preprocess(parseOptionalDate, z.date().nullable().optional()),
    endedAt: z.preprocess(parseOptionalDate, z.date().nullable().optional()),
    durationSec: z.number().int().min(0).max(24 * 60 * 60).optional(),
    recordingUrl: z.preprocess(normalizeOptionalText, z.string().max(1000).nullable().optional()),
    notes: z.preprocess(normalizeOptionalText, z.string().max(2000).nullable().optional()),
  })
  .strict();

const querySchema = z
  .object({
    direction: directionSchema.optional(),
    status: statusSchema.optional(),
    search: z.string().trim().min(1).optional(),
    from: z.preprocess(parseOptionalDate, z.date().nullable().optional()),
    to: z.preprocess(parseOptionalDate, z.date().nullable().optional()),
    contactId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

function mapCall(call: {
  id: string;
  direction: string;
  status: string;
  peerName: string | null;
  peerNumber: string | null;
  peerExtension: string | null;
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSec: number;
  recordingUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  contact: {
    id: string;
    fullName: string;
    phoneNumber: string;
    extensionNumber: string | null;
  } | null;
  counterpartUser: {
    id: string;
    agentDisplayName: string;
    email: string;
  } | null;
}) {
  return {
    id: call.id,
    direction: call.direction,
    status: call.status,
    peerName: call.peerName,
    peerNumber: call.peerNumber,
    peerExtension: call.peerExtension,
    startedAt: call.startedAt,
    answeredAt: call.answeredAt,
    endedAt: call.endedAt,
    durationSec: call.durationSec,
    recordingUrl: call.recordingUrl,
    notes: call.notes,
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
    contact: call.contact,
    counterpartUser: call.counterpartUser
      ? {
          id: call.counterpartUser.id,
          name: call.counterpartUser.agentDisplayName,
          email: call.counterpartUser.email,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const parse = querySchema.safeParse({
    direction: request.nextUrl.searchParams.get("direction") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
    contactId: request.nextUrl.searchParams.get("contactId") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
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

  const { direction, status, search, from, to, contactId, limit } = parse.data;

  const calls = await db.dialerCall.findMany({
    where: {
      agentUserId: auth.user.id,
      ...(direction ? { direction } : {}),
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            startedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(contactId ? { contactId } : {}),
      ...(search
        ? {
            OR: [
              { peerName: { contains: search, mode: "insensitive" as const } },
              { peerNumber: { contains: search, mode: "insensitive" as const } },
              { peerExtension: { contains: search, mode: "insensitive" as const } },
              { notes: { contains: search, mode: "insensitive" as const } },
              { contact: { fullName: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      direction: true,
      status: true,
      peerName: true,
      peerNumber: true,
      peerExtension: true,
      startedAt: true,
      answeredAt: true,
      endedAt: true,
      durationSec: true,
      recordingUrl: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      contact: {
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          extensionNumber: true,
        },
      },
      counterpartUser: {
        select: {
          id: true,
          agentDisplayName: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({
    calls: calls.map(mapCall),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.AGENT, UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  let payload: z.infer<typeof createCallSchema>;
  try {
    payload = createCallSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid call history payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  if (payload.contactId) {
    const contact = await db.dialerContact.findFirst({
      where: { id: payload.contactId, ownerUserId: auth.user.id },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json(
        {
          error: "CONTACT_NOT_FOUND",
          message: "Contact not found for this user.",
        },
        { status: 404 },
      );
    }
  }

  if (payload.counterpartUserId) {
    const agent = await db.user.findFirst({
      where: { id: payload.counterpartUserId, role: UserRole.AGENT },
      select: { id: true },
    });
    if (!agent) {
      return NextResponse.json(
        {
          error: "COUNTERPART_NOT_FOUND",
          message: "Counterpart agent not found.",
        },
        { status: 404 },
      );
    }
  }

  const startedAt = payload.startedAt ?? new Date();
  const endedAt = payload.endedAt ?? null;
  const status = payload.status ?? (endedAt ? "COMPLETED" : "ANSWERED");
  const durationSec =
    payload.durationSec ??
    (endedAt ? Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)) : 0);

  const call = await db.$transaction(async (tx) => {
    const created = await tx.dialerCall.create({
      data: {
        agentUserId: auth.user.id,
        direction: payload.direction,
        status,
        contactId: payload.contactId,
        counterpartUserId: payload.counterpartUserId,
        peerName: payload.peerName ?? null,
        peerNumber: payload.peerNumber ?? null,
        peerExtension: payload.peerExtension ?? null,
        startedAt,
        answeredAt: payload.answeredAt ?? null,
        endedAt,
        durationSec,
        recordingUrl: payload.recordingUrl ?? null,
        notes: payload.notes ?? null,
      },
      select: {
        id: true,
        direction: true,
        status: true,
        peerName: true,
        peerNumber: true,
        peerExtension: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        durationSec: true,
        recordingUrl: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        contact: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            extensionNumber: true,
          },
        },
        counterpartUser: {
          select: {
            id: true,
            agentDisplayName: true,
            email: true,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "DIALER_CALL",
        entityId: created.id,
        action: "DIALER_CALL_LOG_CREATE",
        beforeJson: Prisma.JsonNull,
        afterJson: {
          id: created.id,
          direction: created.direction,
          status: created.status,
          peerName: created.peerName,
          peerNumber: created.peerNumber,
          peerExtension: created.peerExtension,
          startedAt: created.startedAt,
          endedAt: created.endedAt,
          durationSec: created.durationSec,
        },
      },
    });

    return created;
  });

  return NextResponse.json(
    {
      message: "Call history logged.",
      call: mapCall(call),
    },
    { status: 201 },
  );
}
